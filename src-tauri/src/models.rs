use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardRepresentation {
    pub item_index: i64,
    pub format: String,
    pub content: String,
    pub byte_size: Option<String>,
    pub native_type: Option<String>,
    pub binary: bool,
}

#[derive(Debug, Clone)]
pub struct NewClipboardItem {
    pub kind: String,
    pub title: String,
    pub content: String,
    pub detail: String,
    pub byte_size: Option<String>,
    pub content_hash: String,
    pub source_app_id: Option<String>,
    pub source_app_name: Option<String>,
    pub representations: Vec<ClipboardRepresentation>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardItem {
    pub id: i64,
    pub kind: String,
    pub title: String,
    pub content: String,
    pub detail: String,
    pub byte_size: Option<String>,
    pub created_at: i64,
    pub pinned: bool,
    pub source_app_id: Option<String>,
    pub source_app_name: Option<String>,
    pub ocr_text: Option<String>,
    pub ocr_status: Option<String>,
    pub ocr_engine: Option<String>,
    pub ocr_confidence: Option<f64>,
    pub ocr_has_formula: bool,
    pub missing_files: bool,
    pub formats: Vec<String>,
    pub representations: Vec<ClipboardRepresentation>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionStatus {
    pub clipboard_capture: bool,
    pub accessibility: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct AppSettings {
    pub reduce_motion: bool,
    pub capture_enabled: bool,
    pub history_limit: u32,
    pub has_seen_help: bool,
    pub retention_days: u32,
    pub launch_at_login: bool,
    pub direct_paste: bool,
    pub exclude_sensitive_apps: bool,
    pub open_shortcut: String,
    pub batch_shortcut: String,
    pub color_shortcut: String,
    pub toggle_batch_shortcut: String,
    pub language: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            reduce_motion: false,
            capture_enabled: true,
            history_limit: 500,
            has_seen_help: false,
            retention_days: 30,
            launch_at_login: false,
            direct_paste: true,
            exclude_sensitive_apps: false,
            open_shortcut: default_open_shortcut().into(),
            batch_shortcut: default_batch_shortcut().into(),
            color_shortcut: default_color_shortcut().into(),
            toggle_batch_shortcut: default_toggle_batch_shortcut().into(),
            language: "auto".into(),
        }
    }
}

#[cfg(target_os = "windows")]
fn default_open_shortcut() -> &'static str {
    "Control+Shift+Space"
}
#[cfg(not(target_os = "windows"))]
fn default_open_shortcut() -> &'static str {
    "Alt+Space"
}

#[cfg(target_os = "windows")]
fn default_batch_shortcut() -> &'static str {
    "Control+Alt+Space"
}
#[cfg(not(target_os = "windows"))]
fn default_batch_shortcut() -> &'static str {
    "Alt+Shift+Space"
}

#[cfg(target_os = "windows")]
fn default_color_shortcut() -> &'static str {
    "Control+Shift+KeyC"
}
#[cfg(not(target_os = "windows"))]
fn default_color_shortcut() -> &'static str {
    "Alt+Shift+KeyC"
}

#[cfg(target_os = "windows")]
fn default_toggle_batch_shortcut() -> &'static str {
    "Control+Shift+KeyM"
}
#[cfg(not(target_os = "windows"))]
fn default_toggle_batch_shortcut() -> &'static str {
    "Meta+Shift+KeyM"
}
