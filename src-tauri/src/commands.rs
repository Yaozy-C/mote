use std::{path::Path, thread, time::Duration};

use tauri::{image::Image, AppHandle, Emitter, Manager, State};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::{
    error::{AppError, AppResult},
    models::{AppSettings, ClipboardItem, PermissionStatus},
    platform,
    state::AppState,
};

#[cfg(target_os = "macos")]
use crate::models::{ClipboardRepresentation, NewClipboardItem};
#[cfg(target_os = "macos")]
use block2::RcBlock;
#[cfg(target_os = "macos")]
use objc2_app_kit::{NSColor, NSColorSampler, NSColorSpace};

#[tauri::command]
pub fn list_clipboard_items(
    state: State<'_, AppState>,
    query: Option<String>,
) -> AppResult<Vec<ClipboardItem>> {
    let settings = state.database.settings()?;
    state
        .database
        .list_items(query.as_deref(), settings.history_limit)
}

#[tauri::command]
pub fn copy_clipboard_item(app: AppHandle, state: State<'_, AppState>, id: i64) -> AppResult<()> {
    write_item(&app, &state, id)
}

fn write_item(app: &AppHandle, state: &AppState, id: i64) -> AppResult<()> {
    let item = state.database.get_item(id)?;
    write_clipboard_item(app, item)
}

fn write_clipboard_item(app: &AppHandle, item: ClipboardItem) -> AppResult<()> {
    match platform::write_representations(&item.representations) {
        Ok(()) => return Ok(()),
        Err(error) if item.representations.len() > 1 => {
            return Err(AppError::Clipboard(error));
        }
        Err(_) => {}
    }
    if item.kind == "image" && Path::new(&item.content).is_absolute() {
        let image = Image::from_path(&item.content)
            .map_err(|error| AppError::Clipboard(error.to_string()))?;
        app.clipboard()
            .write_image(&image)
            .map_err(|error| AppError::Clipboard(error.to_string()))?;
    } else {
        let value = if item.kind == "image" {
            item.title
        } else {
            item.content
        };
        app.clipboard()
            .write_text(value)
            .map_err(|error| AppError::Clipboard(error.to_string()))?;
    }
    Ok(())
}

#[tauri::command]
pub fn paste_clipboard_item(app: AppHandle, state: State<'_, AppState>, id: i64) -> AppResult<()> {
    write_item(&app, &state, id)?;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    let bundle = state
        .last_active_app
        .lock()
        .ok()
        .and_then(|value| value.clone());
    thread::sleep(Duration::from_millis(80));
    if let Err(error) = platform::paste_into(bundle.as_deref()) {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
        return Err(AppError::Clipboard(error));
    }
    Ok(())
}

#[tauri::command]
pub fn paste_clipboard_items(
    app: AppHandle,
    state: State<'_, AppState>,
    ids: Vec<i64>,
) -> AppResult<()> {
    if ids.is_empty() {
        return Ok(());
    }
    let mut items = ids
        .into_iter()
        .map(|id| state.database.get_item(id))
        .collect::<AppResult<Vec<_>>>()?;
    items.sort_by_key(|item| item.created_at);
    let bundle = state
        .last_active_app
        .lock()
        .ok()
        .and_then(|value| value.clone());
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    thread::sleep(Duration::from_millis(80));

    let item_count = items.len();
    for (index, item) in items.into_iter().enumerate() {
        let result = write_clipboard_item(&app, item)
            .and_then(|_| platform::paste_into(bundle.as_deref()).map_err(AppError::Clipboard));
        if let Err(error) = result {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            return Err(error);
        }
        if index + 1 < item_count {
            thread::sleep(Duration::from_millis(70));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn open_accessibility_settings() -> AppResult<()> {
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .spawn()
        .map(|_| ())
        .map_err(|error| AppError::Clipboard(error.to_string()))?;
    Ok(())
}

#[tauri::command]
pub fn get_permission_status(state: State<'_, AppState>) -> AppResult<PermissionStatus> {
    Ok(PermissionStatus {
        clipboard_capture: state.database.settings()?.capture_enabled,
        accessibility: platform::accessibility_trusted(),
    })
}

#[tauri::command]
pub fn open_external(value: String) -> AppResult<()> {
    if !(value.starts_with("https://") || value.starts_with("http://")) {
        return Err(AppError::Clipboard(
            "Mote can only open web links safely.".into(),
        ));
    }
    platform::open_external(&value).map_err(AppError::Clipboard)
}

#[tauri::command]
pub fn reveal_file(path: String) -> AppResult<()> {
    if !Path::new(&path).exists() {
        return Err(AppError::Clipboard(
            "That file is no longer available at its original location.".into(),
        ));
    }
    platform::reveal_file(&path).map_err(AppError::Clipboard)
}

#[tauri::command]
pub fn check_file_paths(paths: Vec<String>) -> Vec<bool> {
    paths.iter().map(|path| Path::new(path).exists()).collect()
}

#[tauri::command]
pub fn copy_text_value(app: AppHandle, value: String) -> AppResult<()> {
    app.clipboard()
        .write_text(value)
        .map_err(|error| AppError::Clipboard(error.to_string()))
}

#[tauri::command]
pub fn start_color_picker(app: AppHandle) -> AppResult<()> {
    #[cfg(target_os = "macos")]
    {
        let picker_app = app.clone();
        app.run_on_main_thread(move || {
            if let Some(window) = picker_app.get_webview_window("main") {
                let _ = window.hide();
            }
            let callback_app = picker_app.clone();
            let handler = RcBlock::new(move |color: *mut NSColor| {
                let finish = || {
                    if let Some(window) = callback_app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                };
                let Some(color) = (unsafe { color.as_ref() }) else {
                    finish();
                    return;
                };
                let space = NSColorSpace::sRGBColorSpace();
                let Some(color) = color.colorUsingColorSpace(&space) else {
                    finish();
                    return;
                };
                let channel = |value: f64| (value.clamp(0.0, 1.0) * 255.0).round() as u8;
                let hex = format!(
                    "#{:02X}{:02X}{:02X}",
                    channel(color.redComponent()),
                    channel(color.greenComponent()),
                    channel(color.blueComponent())
                );
                let representations = vec![ClipboardRepresentation {
                    item_index: 0,
                    format: "text".into(),
                    content: hex.clone(),
                    byte_size: None,
                    native_type: None,
                    binary: false,
                }];
                let snapshot = NewClipboardItem {
                    kind: "color".into(),
                    title: hex.clone(),
                    content: hex.clone(),
                    detail: "Picked color".into(),
                    byte_size: None,
                    content_hash: crate::watcher::snapshot_hash(&representations),
                    representations,
                };
                let state = callback_app.state::<AppState>();
                let result = state.database.settings().and_then(|settings| {
                    state
                        .database
                        .insert_snapshot(snapshot, settings.history_limit)
                });
                match result {
                    Ok(item) => {
                        let _ = callback_app.clipboard().write_text(hex);
                        let _ = callback_app.emit("mote://clipboard-changed", item.clone());
                        let _ = callback_app.emit("mote://color-picked", item);
                    }
                    Err(error) => {
                        let _ = callback_app.emit("mote://color-picker-error", error.to_string());
                    }
                }
                finish();
            });
            let sampler = NSColorSampler::new();
            unsafe { sampler.showSamplerWithSelectionHandler(&handler) };
        })
        .map_err(|error| AppError::Clipboard(error.to_string()))?;
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    Err(AppError::Clipboard(
        "Screen color picking is currently available on macOS.".into(),
    ))
}

#[tauri::command]
pub fn toggle_clipboard_pin(state: State<'_, AppState>, id: i64) -> AppResult<ClipboardItem> {
    state.database.toggle_pin(id)
}

#[tauri::command]
pub fn delete_clipboard_item(state: State<'_, AppState>, id: i64) -> AppResult<Vec<i64>> {
    Ok(if state.database.delete_item(id)? {
        vec![id]
    } else {
        Vec::new()
    })
}

#[tauri::command]
pub fn clear_unpinned_items(state: State<'_, AppState>) -> AppResult<Vec<i64>> {
    state.database.clear_unpinned()
}

#[tauri::command]
pub fn restore_clipboard_items(state: State<'_, AppState>, ids: Vec<i64>) -> AppResult<u64> {
    state.database.restore_items(&ids)
}

#[tauri::command]
pub fn hide_main_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> AppResult<AppSettings> {
    state.database.settings()
}

#[tauri::command]
pub fn update_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: AppSettings,
) -> AppResult<AppSettings> {
    let previous = state.database.settings()?;
    crate::replace_global_shortcuts(&app, &previous, &settings).map_err(AppError::Clipboard)?;
    if let Err(error) = state.database.save_settings(&settings) {
        let _ = crate::replace_global_shortcuts(&app, &settings, &previous);
        return Err(error);
    }
    let autostart = app.autolaunch();
    let result = if settings.launch_at_login {
        autostart.enable()
    } else {
        autostart.disable()
    };
    result.map_err(|error| AppError::Clipboard(error.to_string()))?;
    Ok(settings)
}
