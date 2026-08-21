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
            open_shortcut: "Alt+Space".into(),
            batch_shortcut: "Alt+Shift+Space".into(),
            toggle_batch_shortcut: "Meta+Shift+KeyM".into(),
            language: "auto".into(),
        }
    }
}
