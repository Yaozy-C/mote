use std::{
    fs::File,
    io::BufWriter,
    path::{Path, PathBuf},
    thread,
    time::{Duration, Instant},
};

use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

use crate::{
    classifier::classify,
    database::Database,
    models::{ClipboardRepresentation, NewClipboardItem},
    platform,
};

const MAX_CAPTURE_CHARS: usize = 100_000;

pub fn spawn(app: AppHandle, database: Database, image_dir: PathBuf) {
    thread::Builder::new()
        .name("mote-clipboard-watcher".into())
        .spawn(move || {
            let mut clipboard = match arboard::Clipboard::new() {
                Ok(clipboard) => clipboard,
                Err(error) => {
                    eprintln!("Mote could not initialize clipboard capture: {error}");
                    return;
                }
            };
            let mut last_snapshot_hash = String::new();
            let mut last_change_count = None;
            let mut last_cleanup = Instant::now();

            loop {
                let settings = database.settings().unwrap_or_default();
                if settings.capture_enabled {
                    let blocked = settings.exclude_sensitive_apps
                        && platform::is_sensitive_app(platform::frontmost_app().as_deref());
                    if !blocked {
                        let start_change = platform::pasteboard_change_count();
                        if start_change.is_none() || start_change != last_change_count {
                            if let Some(snapshot) = capture_snapshot(&mut clipboard, &image_dir) {
                                let end_change = platform::pasteboard_change_count();
                                let stable = start_change.is_none() || start_change == end_change;
                                if stable && snapshot.content_hash != last_snapshot_hash {
                                    last_snapshot_hash = snapshot.content_hash.clone();
                                    last_change_count = end_change;
                                    if let Ok(item) =
                                        database.insert_snapshot(snapshot, settings.history_limit)
                                    {
                                        let _ = app.emit("mote://clipboard-changed", item);
                                    }
                                }
                            }
                        }
                    }
                }
                if last_cleanup.elapsed() >= Duration::from_secs(60 * 60) {
                    let _ = database.cleanup(&settings);
                    last_cleanup = Instant::now();
                }
                thread::sleep(Duration::from_millis(650));
            }
        })
        .expect("failed to spawn clipboard watcher");
}

fn capture_snapshot(
    clipboard: &mut arboard::Clipboard,
    image_dir: &Path,
) -> Option<NewClipboardItem> {
    #[cfg(target_os = "macos")]
    if let Ok(representations) = platform::capture_representations(image_dir) {
        return snapshot_from_representations(representations);
    }

    let text = clipboard
        .get()
        .text()
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty() && value.len() <= MAX_CAPTURE_CHARS);
    let html = clipboard
        .get()
        .html()
        .ok()
        .filter(|value| !value.is_empty() && value.len() <= MAX_CAPTURE_CHARS * 4);
    let files = clipboard
        .get()
        .file_list()
        .ok()
        .filter(|value| !value.is_empty());
    let image = clipboard.get().image().ok().and_then(|image| {
        let hash = hash_bytes(image.bytes.as_ref());
        let path = save_png(
            image_dir,
            &hash,
            image.width,
            image.height,
            image.bytes.as_ref(),
        )
        .ok()?;
        let stored_size = std::fs::metadata(&path)
            .map(|metadata| metadata.len() as usize)
            .unwrap_or(image.bytes.len());
        Some((path, image.width, image.height, stored_size))
    });

    let mut representations = Vec::new();
    if let Some(value) = &text {
        representations.push(ClipboardRepresentation {
            item_index: 0,
            format: "text".into(),
            content: value.clone(),
            byte_size: None,
            native_type: None,
            binary: false,
        });
    }
    if let Some(value) = &html {
        representations.push(ClipboardRepresentation {
            item_index: 0,
            format: "html".into(),
            content: value.clone(),
            byte_size: None,
            native_type: None,
            binary: false,
        });
    }
    if let Some((path, _, _, stored_size)) = &image {
        representations.push(ClipboardRepresentation {
            item_index: 0,
            format: "image".into(),
            content: path.to_string_lossy().to_string(),
            byte_size: Some(format_bytes(*stored_size)),
            native_type: None,
            binary: true,
        });
    }
    if let Some(paths) = &files {
        representations.push(ClipboardRepresentation {
            item_index: 0,
            format: "files".into(),
            content: serde_json::to_string(paths).ok()?,
            byte_size: None,
            native_type: None,
            binary: false,
        });
    }
    if representations.is_empty() {
        return None;
    }

    let content_hash = snapshot_hash(&representations);
    let format_label = representations
        .iter()
        .map(|representation| display_format(&representation.format))
        .collect::<Vec<_>>()
        .join(" + ");

    if let Some((path, width, height, stored_size)) = image {
        let title = text
            .as_deref()
            .map(classify)
            .map(|classification| classification.title)
            .unwrap_or_else(|| format!("Image {width} × {height}"));
        Some(NewClipboardItem {
            kind: "image".into(),
            title,
            content: path.to_string_lossy().to_string(),
            detail: format_label,
            byte_size: Some(format_bytes(stored_size)),
            content_hash,
            representations,
        })
    } else if let Some(value) = text {
        let classification = classify(&value);
        let detail = if representations.len() == 1 {
            classification.detail
        } else {
            format_label
        };
        Some(NewClipboardItem {
            kind: classification.kind.to_string(),
            title: classification.title,
            content: value,
            detail,
            byte_size: None,
            content_hash,
            representations,
        })
    } else if let Some(value) = html {
        Some(NewClipboardItem {
            kind: "html".into(),
            title: "Rich text clipping".into(),
            content: value,
            detail: format_label,
            byte_size: None,
            content_hash,
            representations,
        })
    } else {
        let paths = files?;
        let title = if paths.len() == 1 {
            paths[0]
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("File")
                .to_string()
        } else {
            format!("{} files", paths.len())
        };
        Some(NewClipboardItem {
            kind: "files".into(),
            title,
            content: serde_json::to_string(&paths).ok()?,
            detail: format_label,
            byte_size: None,
            content_hash,
            representations,
        })
    }
}

fn snapshot_from_representations(
    representations: Vec<ClipboardRepresentation>,
) -> Option<NewClipboardItem> {
    if representations.is_empty() {
        return None;
    }
    let content_hash = snapshot_hash(&representations);
    let item_count = representations
        .iter()
        .map(|representation| representation.item_index)
        .max()
        .unwrap_or(0)
        + 1;
    let mut formats = representations
        .iter()
        .filter(|representation| {
            matches!(
                representation.format.as_str(),
                "text" | "html" | "url" | "image" | "files" | "pdf"
            )
        })
        .map(|representation| display_format(&representation.format))
        .collect::<Vec<_>>();
    formats.sort_unstable();
    formats.dedup();
    let format_label = formats.join(" + ");
    let text = representations
        .iter()
        .find(|representation| representation.format == "text")
        .or_else(|| {
            representations
                .iter()
                .find(|representation| representation.format == "url")
        })
        .map(|representation| representation.content.clone());
    let image = representations
        .iter()
        .find(|representation| representation.format == "image");
    let file = representations
        .iter()
        .find(|representation| representation.format == "files");
    let html = representations
        .iter()
        .find(|representation| representation.format == "html");
    let mixed = item_count > 1;

    let (kind, title, content, byte_size) = if mixed {
        let title = text
            .as_deref()
            .map(classify)
            .map(|classification| classification.title)
            .unwrap_or_else(|| format!("Combined clipping ({item_count} items)"));
        let content = text
            .clone()
            .or_else(|| image.map(|representation| representation.content.clone()))
            .or_else(|| file.map(|representation| representation.content.clone()))
            .unwrap_or_default();
        (
            "mixed".into(),
            title,
            content,
            image.and_then(|value| value.byte_size.clone()),
        )
    } else if let Some(value) = text {
        let classification = classify(&value);
        (
            classification.kind.into(),
            classification.title,
            value,
            None,
        )
    } else if let Some(representation) = image {
        (
            "image".into(),
            "Image".into(),
            representation.content.clone(),
            representation.byte_size.clone(),
        )
    } else if let Some(representation) = file {
        let title = representation
            .content
            .rsplit('/')
            .next()
            .filter(|value| !value.is_empty())
            .unwrap_or("File")
            .to_string();
        ("files".into(), title, representation.content.clone(), None)
    } else if let Some(representation) = html {
        (
            "html".into(),
            "Rich text clipping".into(),
            representation.content.clone(),
            None,
        )
    } else {
        let first = representations.first()?;
        (
            "rich".into(),
            "Rich clipping".into(),
            first.content.clone(),
            first.byte_size.clone(),
        )
    };
    let detail = if mixed {
        format!("{item_count} items · {format_label}")
    } else if format_label.is_empty() {
        "Rich content".into()
    } else {
        format_label
    };

    Some(NewClipboardItem {
        kind,
        title,
        content,
        detail,
        byte_size,
        content_hash,
        representations,
    })
}

fn snapshot_hash(representations: &[ClipboardRepresentation]) -> String {
    let mut hasher = Sha256::new();
    for representation in representations {
        hasher.update(representation.item_index.to_le_bytes());
        hasher.update(representation.format.as_bytes());
        hasher.update([0]);
        hasher.update(representation.content.as_bytes());
        hasher.update([0xff]);
    }
    format!("{:x}", hasher.finalize())
}

fn display_format(format: &str) -> &'static str {
    match format {
        "text" => "Text",
        "html" => "HTML",
        "url" => "URL",
        "image" => "Image",
        "files" => "Files",
        "pdf" => "PDF",
        _ => "Data",
    }
}

fn format_bytes(bytes: usize) -> String {
    if bytes >= 1_048_576 {
        format!("{:.1} MB", bytes as f64 / 1_048_576.0)
    } else {
        format!("{} KB", (bytes / 1024).max(1))
    }
}

fn save_png(
    dir: &Path,
    hash: &str,
    width: usize,
    height: usize,
    rgba: &[u8],
) -> Result<PathBuf, std::io::Error> {
    std::fs::create_dir_all(dir)?;
    let path = dir.join(format!("{hash}.png"));
    if path.exists() {
        return Ok(path);
    }
    let file = File::create(&path)?;
    let mut encoder = png::Encoder::new(BufWriter::new(file), width as u32, height as u32);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder.write_header().map_err(std::io::Error::other)?;
    writer
        .write_image_data(rgba)
        .map_err(std::io::Error::other)?;
    writer.finish().map_err(std::io::Error::other)?;
    Ok(path)
}

fn hash_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}
