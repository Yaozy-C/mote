use std::{collections::BTreeMap, path::Path, process::Command};

use crate::models::ClipboardRepresentation;

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
}

#[cfg(target_os = "windows")]
#[link(name = "user32")]
extern "system" {
    fn GetForegroundWindow() -> isize;
    fn SetForegroundWindow(window: isize) -> i32;
    fn GetWindowThreadProcessId(window: isize, process_id: *mut u32) -> u32;
    fn keybd_event(virtual_key: u8, scan_code: u8, flags: u32, extra_info: usize);
}

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
extern "system" {
    fn OpenProcess(access: u32, inherit_handle: i32, process_id: u32) -> isize;
    fn QueryFullProcessImageNameW(
        process: isize,
        flags: u32,
        path: *mut u16,
        size: *mut u32,
    ) -> i32;
    fn CloseHandle(handle: isize) -> i32;
}

pub fn accessibility_trusted() -> bool {
    #[cfg(target_os = "macos")]
    unsafe {
        return AXIsProcessTrusted();
    }
    #[cfg(target_os = "windows")]
    return true;
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    false
}

pub fn open_external(value: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return Command::new("open")
        .arg(value)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string());
    #[cfg(target_os = "windows")]
    return Command::new("explorer.exe")
        .arg(value)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string());
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    Err("Opening links is not available on this platform.".into())
}

pub fn reveal_file(path: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return Command::new("open")
        .args(["-R", path])
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string());
    #[cfg(target_os = "windows")]
    return Command::new("explorer.exe")
        .arg(format!("/select,{path}"))
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string());
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    Err("Revealing files is not available on this platform.".into())
}

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

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
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

#[cfg(target_os = "windows")]
pub fn pasteboard_change_count() -> Option<i64> {
    clipboard_win::raw::seq_num().map(|value| value.get() as i64)
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
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

#[cfg(target_os = "windows")]
pub fn write_representations(representations: &[ClipboardRepresentation]) -> Result<(), String> {
    use arboard::ImageData;
    use clipboard_win::{options, raw};
    use std::{borrow::Cow, path::PathBuf};

    let text = representations
        .iter()
        .find(|value| value.format == "text" || value.format == "url")
        .map(|value| value.content.as_str());
    let html = representations
        .iter()
        .find(|value| value.format == "html")
        .map(|value| value.content.as_str());
    let image = representations.iter().find(|value| value.format == "image");
    let files = representations
        .iter()
        .find(|value| value.format == "files")
        .and_then(|value| serde_json::from_str::<Vec<PathBuf>>(&value.content).ok())
        .filter(|paths| !paths.is_empty());

    let mut clipboard = arboard::Clipboard::new().map_err(|error| error.to_string())?;
    if let Some(paths) = files {
        clipboard
            .set()
            .file_list(&paths)
            .map_err(|error| error.to_string())?;
    } else if let Some(value) = image {
        let decoded = decode_png(Path::new(&value.content))?;
        clipboard
            .set_image(ImageData {
                width: decoded.0,
                height: decoded.1,
                bytes: Cow::Owned(decoded.2),
            })
            .map_err(|error| error.to_string())?;
    } else if let Some(markup) = html {
        clipboard
            .set()
            .html(markup, text)
            .map_err(|error| error.to_string())?;
    } else if let Some(value) = text {
        clipboard
            .set_text(value)
            .map_err(|error| error.to_string())?;
    } else {
        return Err("No supported clipboard representation was found.".into());
    }
    drop(clipboard);

    // Images and file lists are the primary Windows clipboard format. Add their
    // textual representations without clearing so a combined copy remains one record.
    if image.is_some() || representations.iter().any(|value| value.format == "files") {
        let _guard =
            clipboard_win::Clipboard::new_attempts(10).map_err(|error| error.to_string())?;
        if let Some(value) = text {
            raw::set_string_with(value, options::NoClear).map_err(|error| error.to_string())?;
        }
        if let Some(markup) = html {
            let format = raw::register_format("HTML Format")
                .ok_or_else(|| "Mote could not register the HTML clipboard format.".to_string())?;
            raw::set_html_with(format.get(), markup, options::NoClear)
                .map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn decode_png(path: &Path) -> Result<(usize, usize, Vec<u8>), String> {
    use png::{ColorType, Transformations};
    let file = std::fs::File::open(path).map_err(|error| error.to_string())?;
    let mut decoder = png::Decoder::new(std::io::BufReader::new(file));
    decoder.set_transformations(Transformations::EXPAND | Transformations::STRIP_16);
    let mut reader = decoder.read_info().map_err(|error| error.to_string())?;
    let size = reader
        .output_buffer_size()
        .ok_or_else(|| "The image is too large to restore.".to_string())?;
    let mut buffer = vec![0; size];
    let info = reader
        .next_frame(&mut buffer)
        .map_err(|error| error.to_string())?;
    let pixels = &buffer[..info.buffer_size()];
    let rgba = match info.color_type {
        ColorType::Rgba => pixels.to_vec(),
        ColorType::Rgb => pixels
            .chunks_exact(3)
            .flat_map(|pixel| [pixel[0], pixel[1], pixel[2], 255])
            .collect(),
        ColorType::GrayscaleAlpha => pixels
            .chunks_exact(2)
            .flat_map(|pixel| [pixel[0], pixel[0], pixel[0], pixel[1]])
            .collect(),
        ColorType::Grayscale => pixels
            .iter()
            .flat_map(|value| [*value, *value, *value, 255])
            .collect(),
        ColorType::Indexed => return Err("Mote could not decode this cached image.".into()),
    };
    Ok((info.width as usize, info.height as usize, rgba))
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
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

#[cfg(target_os = "windows")]
pub fn frontmost_app() -> Option<String> {
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    unsafe {
        let window = GetForegroundWindow();
        if window == 0 {
            return None;
        }
        let mut process_id = 0;
        GetWindowThreadProcessId(window, &mut process_id);
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id);
        let executable = if process == 0 {
            String::new()
        } else {
            let mut path = vec![0u16; 32_768];
            let mut length = path.len() as u32;
            let success = QueryFullProcessImageNameW(process, 0, path.as_mut_ptr(), &mut length);
            CloseHandle(process);
            if success == 0 {
                String::new()
            } else {
                String::from_utf16_lossy(&path[..length as usize])
            }
        };
        Some(format!("{window}|{executable}"))
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
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

#[cfg(target_os = "windows")]
pub fn paste_into(target: Option<&str>) -> Result<(), String> {
    const VK_CONTROL: u8 = 0x11;
    const VK_V: u8 = 0x56;
    const KEYEVENTF_KEYUP: u32 = 0x0002;
    if let Some(window) = target
        .and_then(|value| {
            value
                .split_once('|')
                .map(|parts| parts.0)
                .unwrap_or(value)
                .parse::<isize>()
                .ok()
        })
        .filter(|window| *window != 0)
    {
        unsafe {
            SetForegroundWindow(window);
        }
    }
    std::thread::sleep(std::time::Duration::from_millis(140));
    unsafe {
        keybd_event(VK_CONTROL, 0, 0, 0);
        keybd_event(VK_V, 0, 0, 0);
        keybd_event(VK_V, 0, KEYEVENTF_KEYUP, 0);
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
    }
    Ok(())
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn paste_into(_bundle_id: Option<&str>) -> Result<(), String> {
    Err("Direct paste is not available on this platform.".into())
}

pub fn is_sensitive_app(bundle_id: Option<&str>) -> bool {
    #[cfg(target_os = "windows")]
    return bundle_id.is_some_and(|value| {
        let executable = value.to_ascii_lowercase();
        [
            "1password",
            "bitwarden",
            "lastpass",
            "keepass",
            "credential",
        ]
        .iter()
        .any(|name| executable.contains(name))
    });

    #[cfg(not(target_os = "windows"))]
    {
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
}
