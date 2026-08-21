use std::{collections::BTreeMap, path::Path, process::Command};

use crate::models::ClipboardRepresentation;

#[cfg(target_os = "macos")]
pub fn pasteboard_change_count() -> Option<i64> {
    use objc2_app_kit::NSPasteboard;
    Some(NSPasteboard::generalPasteboard().changeCount() as i64)
}

#[cfg(target_os = "macos")]
pub fn capture_representations(cache_dir: &Path) -> Result<Vec<ClipboardRepresentation>, String> {
    use objc2_app_kit::{
        NSPasteboard, NSPasteboardTypeFileURL, NSPasteboardTypeHTML, NSPasteboardTypePDF,
        NSPasteboardTypePNG, NSPasteboardTypeRTF, NSPasteboardTypeRTFD, NSPasteboardTypeString,
        NSPasteboardTypeTIFF, NSPasteboardTypeURL,
    };

    const MAX_TEXT_BYTES: usize = 400_000;
    const MAX_BINARY_BYTES: usize = 25 * 1024 * 1024;

    let pasteboard = NSPasteboard::generalPasteboard();
    let items = pasteboard
        .pasteboardItems()
        .ok_or_else(|| "The clipboard does not contain readable items.".to_string())?;
    let mut representations = Vec::new();

    for (item_index, item) in items.iter().enumerate() {
        let mut add_string = |format: &str, native_type: &objc2_foundation::NSString| {
            if let Some(value) = item.stringForType(native_type) {
                let value = value.to_string();
                if !value.is_empty() && value.len() <= MAX_TEXT_BYTES {
                    representations.push(ClipboardRepresentation {
                        item_index: item_index as i64,
                        format: format.into(),
                        content: value,
                        byte_size: None,
                        native_type: Some(native_type.to_string()),
                        binary: false,
                    });
                }
            }
        };

        unsafe {
            add_string("text", NSPasteboardTypeString);
            add_string("html", NSPasteboardTypeHTML);
            add_string("url", NSPasteboardTypeURL);
            add_string("files", NSPasteboardTypeFileURL);
        }

        let mut add_binary =
            |format: &str, extension: &str, native_type: &objc2_foundation::NSString| {
                if let Some(data) = item.dataForType(native_type) {
                    let bytes = data.to_vec();
                    if !bytes.is_empty() && bytes.len() <= MAX_BINARY_BYTES {
                        if let Ok(path) = save_native_payload(cache_dir, &bytes, extension) {
                            representations.push(ClipboardRepresentation {
                                item_index: item_index as i64,
                                format: format.into(),
                                content: path.to_string_lossy().to_string(),
                                byte_size: Some(format_bytes(bytes.len())),
                                native_type: Some(native_type.to_string()),
                                binary: true,
                            });
                        }
                    }
                }
            };

        unsafe {
            // PNG is preferred for previewing. TIFF is retained when it is the only image payload.
            if item.dataForType(NSPasteboardTypePNG).is_some() {
                add_binary("image", "png", NSPasteboardTypePNG);
            } else {
                add_binary("image", "tiff", NSPasteboardTypeTIFF);
            }
            add_binary("rtf", "rtf", NSPasteboardTypeRTF);
            add_binary("rtfd", "rtfd", NSPasteboardTypeRTFD);
            add_binary("pdf", "pdf", NSPasteboardTypePDF);
        }
    }

    (!representations.is_empty())
        .then_some(representations)
        .ok_or_else(|| "The clipboard does not contain a supported content type.".into())
}

#[cfg(not(target_os = "macos"))]
pub fn capture_representations(_cache_dir: &Path) -> Result<Vec<ClipboardRepresentation>, String> {
    Err("Native compound clipboard capture is available on macOS only.".into())
}

#[cfg(target_os = "macos")]
fn save_native_payload(
    dir: &Path,
    bytes: &[u8],
    extension: &str,
) -> Result<std::path::PathBuf, String> {
    use sha2::{Digest, Sha256};
    std::fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    let hash = format!("{:x}", Sha256::digest(bytes));
    let path = dir.join(format!("{hash}.{extension}"));
    if !path.exists() {
        std::fs::write(&path, bytes).map_err(|error| error.to_string())?;
    }
    Ok(path)
}

fn format_bytes(bytes: usize) -> String {
    if bytes >= 1_048_576 {
        format!("{:.1} MB", bytes as f64 / 1_048_576.0)
    } else {
        format!("{} KB", (bytes / 1024).max(1))
    }
}

#[cfg(not(target_os = "macos"))]
pub fn pasteboard_change_count() -> Option<i64> {
    None
}

#[cfg(target_os = "macos")]
pub fn write_representations(representations: &[ClipboardRepresentation]) -> Result<(), String> {
    use objc2::runtime::ProtocolObject;
    use objc2_app_kit::{
        NSPasteboard, NSPasteboardItem, NSPasteboardTypeFileURL, NSPasteboardTypeHTML,
        NSPasteboardTypePDF, NSPasteboardTypePNG, NSPasteboardTypeRTF, NSPasteboardTypeRTFD,
        NSPasteboardTypeString, NSPasteboardTypeURL, NSPasteboardWriting,
    };
    use objc2_foundation::{NSArray, NSData, NSString};

    let pasteboard = NSPasteboard::generalPasteboard();
    let mut grouped: BTreeMap<i64, Vec<&ClipboardRepresentation>> = BTreeMap::new();
    for representation in representations {
        grouped
            .entry(representation.item_index)
            .or_default()
            .push(representation);
    }
    if grouped.is_empty() {
        return Err("No supported clipboard representation was found.".into());
    }

    let mut wrote_any = false;
    let mut pasteboard_items = Vec::new();
    for item_representations in grouped.into_values() {
        let item = NSPasteboardItem::new();
        let mut item_written = false;
        for representation in item_representations {
            let fallback_type = unsafe {
                match representation.format.as_str() {
                    "text" => NSPasteboardTypeString,
                    "html" => NSPasteboardTypeHTML,
                    "url" => NSPasteboardTypeURL,
                    "image" => NSPasteboardTypePNG,
                    "files" => NSPasteboardTypeFileURL,
                    "rtf" => NSPasteboardTypeRTF,
                    "rtfd" => NSPasteboardTypeRTFD,
                    "pdf" => NSPasteboardTypePDF,
                    _ => continue,
                }
            };
            let owned_type = representation
                .native_type
                .as_deref()
                .map(NSString::from_str);
            let data_type = owned_type.as_deref().unwrap_or(fallback_type);
            let should_read_file = representation.binary
                || (representation.format == "image"
                    && Path::new(&representation.content).is_absolute());
            let written = if should_read_file {
                std::fs::read(&representation.content)
                    .ok()
                    .map(|bytes| item.setData_forType(&NSData::from_vec(bytes), data_type))
                    .unwrap_or(false)
            } else {
                let content =
                    if representation.format == "files" && representation.native_type.is_none() {
                        serde_json::from_str::<Vec<std::path::PathBuf>>(&representation.content)
                            .ok()
                            .and_then(|paths| paths.first().cloned())
                            .map(|path| format!("file://{}", path.to_string_lossy()))
                            .unwrap_or_else(|| representation.content.clone())
                    } else {
                        representation.content.clone()
                    };
                item.setString_forType(&NSString::from_str(&content), data_type)
            };
            item_written |= written;
            wrote_any |= written;
        }
        if item_written {
            pasteboard_items.push(ProtocolObject::<dyn NSPasteboardWriting>::from_retained(
                item,
            ));
        }
    }
    if !wrote_any || pasteboard_items.is_empty() {
        return Err("Mote could not restore this clipboard item.".into());
    }
    pasteboard.clearContents();
    let objects = NSArray::from_retained_slice(&pasteboard_items);
    pasteboard
        .writeObjects(&objects)
        .then_some(())
        .ok_or_else(|| "Mote could not write the compound clipboard item.".into())
}

#[cfg(not(target_os = "macos"))]
pub fn write_representations(_representations: &[ClipboardRepresentation]) -> Result<(), String> {
    Err("Multi-format clipboard write is not available on this platform.".into())
}

#[cfg(target_os = "macos")]
pub fn frontmost_app() -> Option<String> {
    let output = Command::new("osascript")
        .args([
            "-e",
            "tell application \"System Events\" to get bundle identifier of first application process whose frontmost is true",
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let bundle = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!bundle.is_empty()).then_some(bundle)
}

#[cfg(not(target_os = "macos"))]
pub fn frontmost_app() -> Option<String> {
    None
}

#[cfg(target_os = "macos")]
pub fn paste_into(bundle_id: Option<&str>) -> Result<(), String> {
    let activation = bundle_id
        .map(|bundle| {
            format!(
                "tell application id \"{}\" to activate\n",
                bundle.replace('"', "")
            )
        })
        .unwrap_or_default();
    let script = format!(
        "{activation}delay 0.16\ntell application \"System Events\" to keystroke \"v\" using command down"
    );
    let output = Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|error| error.to_string())?;
    if output.status.success() {
        Ok(())
    } else {
        Err("Allow Mote in System Settings → Privacy & Security → Accessibility to paste automatically.".into())
    }
}

#[cfg(not(target_os = "macos"))]
pub fn paste_into(_bundle_id: Option<&str>) -> Result<(), String> {
    Err("Direct paste is currently available on macOS only.".into())
}

pub fn is_sensitive_app(bundle_id: Option<&str>) -> bool {
    const SENSITIVE: &[&str] = &[
        "com.1password.1password",
        "com.agilebits.onepassword7",
        "com.bitwarden.desktop",
        "com.lastpass.LastPass",
        "com.apple.keychainaccess",
    ];
    bundle_id.is_some_and(|bundle| {
        SENSITIVE
            .iter()
            .any(|candidate| bundle.eq_ignore_ascii_case(candidate))
    })
}
