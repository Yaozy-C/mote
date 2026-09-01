use std::{collections::BTreeMap, path::Path, thread, time::Duration};

use tauri::{image::Image, AppHandle, Emitter, Manager, State};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::{
    error::{AppError, AppResult},
    long_screenshot,
    models::{
        AppSettings, ClipboardItem, ClipboardRepresentation, LongScreenshotTarget, PermissionStatus,
    },
    platform,
    state::AppState,
};

#[cfg(target_os = "macos")]
use crate::models::NewClipboardItem;
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

#[tauri::command]
pub fn copy_clipboard_item_plain_text(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
) -> AppResult<()> {
    let item = state.database.get_item(id)?;
    write_plain_text(&app, plain_text_for_item(&item)?)
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
pub fn paste_clipboard_item_plain_text(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
) -> AppResult<()> {
    let item = state.database.get_item(id)?;
    let value = plain_text_for_item(&item)?;
    write_plain_text(&app, value)?;
    paste_current_clipboard(&app, &state)
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
    let items = ids
        .into_iter()
        .map(|id| state.database.get_item(id))
        .collect::<AppResult<Vec<_>>>()?;
    let representations =
        combine_representations(items.iter().map(|item| item.representations.as_slice()));
    platform::write_representations(&representations).map_err(AppError::Clipboard)?;
    paste_current_clipboard(&app, &state)
}

fn combine_representations<'a>(
    groups: impl IntoIterator<Item = &'a [ClipboardRepresentation]>,
) -> Vec<ClipboardRepresentation> {
    let mut combined = Vec::new();
    let mut next_item_index = 0;
    for representations in groups {
        let index_map = representations
            .iter()
            .map(|representation| representation.item_index)
            .collect::<std::collections::BTreeSet<_>>()
            .into_iter()
            .enumerate()
            .map(|(offset, item_index)| (item_index, next_item_index + offset as i64))
            .collect::<BTreeMap<_, _>>();
        next_item_index += index_map.len() as i64;
        for representation in representations {
            let mut combined_representation = representation.clone();
            combined_representation.item_index = index_map[&representation.item_index];
            combined.push(combined_representation);
        }
    }
    combined
}

#[cfg(test)]
mod combined_paste_tests {
    use super::*;

    fn representation(item_index: i64, format: &str) -> ClipboardRepresentation {
        ClipboardRepresentation {
            item_index,
            format: format.into(),
            content: format.into(),
            byte_size: None,
            native_type: None,
            binary: false,
        }
    }

    #[test]
    fn preserves_selected_and_internal_item_order() {
        let first = vec![representation(4, "text"), representation(4, "html")];
        let second = vec![representation(0, "image"), representation(2, "text")];

        let combined = combine_representations([first.as_slice(), second.as_slice()]);
        let order = combined
            .iter()
            .map(|value| (value.item_index, value.format.as_str()))
            .collect::<Vec<_>>();

        assert_eq!(
            order,
            vec![(0, "text"), (0, "html"), (1, "image"), (2, "text")]
        );
    }
}

fn write_plain_text(app: &AppHandle, value: String) -> AppResult<()> {
    app.clipboard()
        .write_text(value)
        .map_err(|error| AppError::Clipboard(error.to_string()))
}

fn plain_text_for_item(item: &ClipboardItem) -> AppResult<String> {
    if item.kind == "image" {
        return item
            .ocr_text
            .clone()
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| {
                AppError::Clipboard("Recognized text is not available for this image yet.".into())
            });
    }
    if let Some(value) = item
        .representations
        .iter()
        .find(|value| matches!(value.format.as_str(), "text" | "url"))
        .map(|value| value.content.clone())
    {
        return Ok(value);
    }
    if item.kind == "files" {
        if let Ok(paths) = serde_json::from_str::<Vec<String>>(&item.content) {
            return Ok(paths.join("\n"));
        }
    }
    if !item.content.trim().is_empty() && !Path::new(&item.content).is_absolute() {
        return Ok(strip_html(&item.content));
    }
    item.ocr_text
        .clone()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AppError::Clipboard("This record has no plain-text value.".into()))
}

fn strip_html(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut inside_tag = false;
    for character in value.chars() {
        match character {
            '<' => inside_tag = true,
            '>' => inside_tag = false,
            _ if !inside_tag => output.push(character),
            _ => {}
        }
    }
    output
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn paste_current_clipboard(app: &AppHandle, state: &AppState) -> AppResult<()> {
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
pub fn request_accessibility_access() -> AppResult<bool> {
    let trusted = long_screenshot::request_accessibility();
    if !trusted {
        open_accessibility_settings()?;
    }
    Ok(trusted)
}

#[tauri::command]
pub fn get_permission_status(state: State<'_, AppState>) -> AppResult<PermissionStatus> {
    Ok(PermissionStatus {
        clipboard_capture: state.database.settings()?.capture_enabled,
        accessibility: platform::accessibility_trusted(),
        screen_capture: long_screenshot::screen_capture_ready(),
    })
}

#[tauri::command]
pub fn request_screen_capture_access() -> bool {
    long_screenshot::request_screen_capture()
}

#[tauri::command]
pub fn get_long_screenshot_target(state: State<'_, AppState>) -> AppResult<LongScreenshotTarget> {
    let bundle_id = state
        .last_active_app
        .lock()
        .ok()
        .and_then(|value| value.clone())
        .filter(|value| value != "com.mote.clipboard")
        .ok_or_else(|| {
            AppError::Clipboard(
                "Open Mote from the app you want to capture, then try again.".into(),
            )
        })?;
    let name = bundle_id
        .rsplit('.')
        .next()
        .filter(|value| !value.is_empty())
        .unwrap_or("App")
        .to_string();
    Ok(LongScreenshotTarget { bundle_id, name })
}

#[tauri::command]
pub async fn start_native_long_screenshot(
    app: AppHandle,
    state: State<'_, AppState>,
    max_steps: Option<u32>,
) -> AppResult<()> {
    if !platform::accessibility_trusted() {
        return Err(AppError::Clipboard(
            "Accessibility access is required to scroll the target application.".into(),
        ));
    }
    if !long_screenshot::screen_capture_ready() && !long_screenshot::request_screen_capture() {
        return Err(AppError::Clipboard(
            "Screen Recording access is required to capture the target window.".into(),
        ));
    }
    let target = get_long_screenshot_target(state)?;
    let output = std::env::temp_dir().join(format!(
        "mote-long-screenshot-{}.png",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    ));
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    thread::sleep(Duration::from_millis(180));
    let bundle_id = target.bundle_id;
    let capture_output = output.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        long_screenshot::capture(&bundle_id, &capture_output, max_steps.unwrap_or(36))
    })
    .await
    .map_err(|error| error.to_string())
    .and_then(|value| value);

    let write_result = result.map_err(AppError::Clipboard).and_then(|_| {
        let image =
            Image::from_path(&output).map_err(|error| AppError::Clipboard(error.to_string()))?;
        app.clipboard()
            .write_image(&image)
            .map_err(|error| AppError::Clipboard(error.to_string()))
    });
    let _ = std::fs::remove_file(&output);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
    if write_result.is_ok() {
        let _ = app.emit("mote://long-screenshot-complete", ());
    }
    write_result
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
pub fn write_captured_image(
    app: AppHandle,
    rgba: Vec<u8>,
    width: u32,
    height: u32,
) -> AppResult<()> {
    let expected = (width as usize)
        .checked_mul(height as usize)
        .and_then(|value| value.checked_mul(4))
        .ok_or_else(|| AppError::Clipboard("The captured image is too large.".into()))?;
    if width == 0 || height == 0 || rgba.len() != expected {
        return Err(AppError::Clipboard(
            "The captured image data is incomplete.".into(),
        ));
    }
    let image = Image::new_owned(rgba, width, height);
    app.clipboard()
        .write_image(&image)
        .map_err(|error| AppError::Clipboard(error.to_string()))
}

#[tauri::command]
pub fn paste_text_value(
    app: AppHandle,
    state: State<'_, AppState>,
    value: String,
) -> AppResult<()> {
    if value.trim().is_empty() {
        return Err(AppError::Clipboard("There is no text to paste.".into()));
    }
    write_plain_text(&app, value)?;
    paste_current_clipboard(&app, &state)
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
                    source_app_id: None,
                    source_app_name: None,
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
