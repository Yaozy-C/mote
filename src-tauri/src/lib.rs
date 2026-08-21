mod classifier;
mod commands;
mod database;
mod error;
mod models;
mod platform;
mod state;
mod watcher;

use database::Database;
use models::AppSettings;
use state::AppState;
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

fn configured_shortcuts(settings: &AppSettings) -> Result<(Shortcut, Shortcut), String> {
    let open = settings
        .open_shortcut
        .parse::<Shortcut>()
        .map_err(|error| format!("Invalid Open Mote shortcut: {error}"))?;
    let batch = settings
        .batch_shortcut
        .parse::<Shortcut>()
        .map_err(|error| format!("Invalid Multiple Paste shortcut: {error}"))?;
    if open == batch {
        return Err("Open Mote and Open Multiple Paste must use different shortcuts.".into());
    }
    if settings.toggle_batch_shortcut == settings.open_shortcut
        || settings.toggle_batch_shortcut == settings.batch_shortcut
    {
        return Err("Each Mote shortcut must use a different key combination.".into());
    }
    Ok((open, batch))
}

pub(crate) fn replace_global_shortcuts(
    app: &tauri::AppHandle,
    previous: &AppSettings,
    next: &AppSettings,
) -> Result<(), String> {
    let next_shortcuts = configured_shortcuts(next)?;
    if previous.open_shortcut == next.open_shortcut
        && previous.batch_shortcut == next.batch_shortcut
    {
        return Ok(());
    }
    let manager = app.global_shortcut();
    manager
        .unregister_all()
        .map_err(|error| error.to_string())?;
    if let Err(error) = manager.register_multiple([next_shortcuts.0, next_shortcuts.1]) {
        let _ = manager.unregister_all();
        if let Ok(previous_shortcuts) = configured_shortcuts(previous) {
            let _ = manager.register_multiple([previous_shortcuts.0, previous_shortcuts.1]);
        }
        return Err(format!("Mote could not register that shortcut: {error}"));
    }
    Ok(())
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = app.emit("mote://focus-search", ());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    let Ok(settings) = app.state::<AppState>().database.settings() else {
                        return;
                    };
                    let Ok((open_shortcut, batch_shortcut)) = configured_shortcuts(&settings)
                    else {
                        return;
                    };
                    if shortcut == &open_shortcut || shortcut == &batch_shortcut {
                        if let Ok(mut active) = app.state::<AppState>().last_active_app.lock() {
                            *active = platform::frontmost_app();
                        }
                        show_main_window(app);
                        if shortcut == &batch_shortcut {
                            let _ = app.emit("mote://open-batch", ());
                        }
                    }
                })
                .build(),
        )
        .setup(move |app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let database = Database::open(&data_dir.join("mote.sqlite3"))?;
            database.cleanup(&database.settings().unwrap_or_default())?;
            app.manage(AppState {
                database: database.clone(),
                last_active_app: Arc::new(Mutex::new(None)),
            });
            watcher::spawn(app.handle().clone(), database, data_dir.join("images"));

            let settings = app
                .state::<AppState>()
                .database
                .settings()
                .unwrap_or_default();
            match configured_shortcuts(&settings) {
                Ok((open, batch)) => {
                    if let Err(error) = app.global_shortcut().register_multiple([open, batch]) {
                        eprintln!("Mote could not register its shortcuts: {error}");
                    }
                }
                Err(error) => eprintln!("Mote shortcut settings are invalid: {error}"),
            }

            let open = MenuItem::with_id(app, "open", "Open Mote", true, None::<&str>)?;
            let clear =
                MenuItem::with_id(app, "clear", "Clear Unpinned History", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Mote", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &clear, &quit])?;
            TrayIconBuilder::with_id("mote-tray")
                .icon(app.default_window_icon().expect("Mote app icon").clone())
                .tooltip("Mote Clipboard")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main_window(app),
                    "clear" => {
                        let _ = app.state::<AppState>().database.clear_unpinned();
                        let _ = app.emit("mote://clipboard-changed", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_clipboard_items,
            commands::copy_clipboard_item,
            commands::paste_clipboard_item,
            commands::paste_clipboard_items,
            commands::toggle_clipboard_pin,
            commands::delete_clipboard_item,
            commands::clear_unpinned_items,
            commands::hide_main_window,
            commands::open_accessibility_settings,
            commands::get_settings,
            commands::update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mote");
}
