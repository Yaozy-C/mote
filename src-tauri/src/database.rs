use std::{
    path::Path,
    sync::{Arc, Mutex},
};

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::{
    error::{AppError, AppResult},
    models::{AppSettings, ClipboardItem, ClipboardRepresentation, NewClipboardItem},
};

#[derive(Clone)]
pub struct Database {
    connection: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn open(path: &Path) -> AppResult<Self> {
        let connection = Connection::open(path)?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        let database = Self {
            connection: Arc::new(Mutex::new(connection)),
        };
        database.migrate()?;
        Ok(database)
    }

    fn migrate(&self) -> AppResult<()> {
        let connection = self.lock()?;
        connection.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS clipboard_items (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                kind        TEXT NOT NULL,
                title       TEXT NOT NULL,
                content     TEXT NOT NULL,
                detail      TEXT NOT NULL,
                byte_size   TEXT,
                created_at  INTEGER NOT NULL,
                pinned      INTEGER NOT NULL DEFAULT 0,
                deleted_at  INTEGER,
                content_hash TEXT NOT NULL UNIQUE,
                source_app_id TEXT,
                source_app_name TEXT,
                ocr_text TEXT,
                ocr_status TEXT,
                ocr_engine TEXT,
                ocr_confidence REAL,
                ocr_has_formula INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_clipboard_items_created_at
                ON clipboard_items(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_clipboard_items_pinned_created
                ON clipboard_items(pinned DESC, created_at DESC);

            CREATE TABLE IF NOT EXISTS app_settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS clipboard_representations (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id     INTEGER NOT NULL REFERENCES clipboard_items(id) ON DELETE CASCADE,
                item_index  INTEGER NOT NULL DEFAULT 0,
                format      TEXT NOT NULL,
                content     TEXT NOT NULL,
                byte_size   TEXT,
                native_type TEXT,
                binary      INTEGER NOT NULL DEFAULT 0,
                UNIQUE(item_id, item_index, format)
            );

            CREATE INDEX IF NOT EXISTS idx_clipboard_representations_item
                ON clipboard_representations(item_id, item_index);

            INSERT OR IGNORE INTO clipboard_representations (item_id, item_index, format, content, byte_size)
            SELECT id, 0,
                CASE WHEN kind = 'image' THEN 'image'
                     WHEN kind = 'html' THEN 'html'
                     ELSE 'text' END,
                content, byte_size
            FROM clipboard_items;
            "#,
        )?;
        // Existing prototype databases predate native pasteboard payload storage.
        // SQLite has no `ADD COLUMN IF NOT EXISTS`, so duplicate-column errors are harmless.
        let _ = connection.execute(
            "ALTER TABLE clipboard_representations ADD COLUMN native_type TEXT",
            [],
        );
        let _ = connection.execute(
            "ALTER TABLE clipboard_representations ADD COLUMN binary INTEGER NOT NULL DEFAULT 0",
            [],
        );
        let _ = connection.execute(
            "ALTER TABLE clipboard_items ADD COLUMN deleted_at INTEGER",
            [],
        );
        for migration in [
            "ALTER TABLE clipboard_items ADD COLUMN source_app_id TEXT",
            "ALTER TABLE clipboard_items ADD COLUMN source_app_name TEXT",
            "ALTER TABLE clipboard_items ADD COLUMN ocr_text TEXT",
            "ALTER TABLE clipboard_items ADD COLUMN ocr_status TEXT",
            "ALTER TABLE clipboard_items ADD COLUMN ocr_engine TEXT",
            "ALTER TABLE clipboard_items ADD COLUMN ocr_confidence REAL",
            "ALTER TABLE clipboard_items ADD COLUMN ocr_has_formula INTEGER NOT NULL DEFAULT 0",
        ] {
            let _ = connection.execute(migration, []);
        }
        // Early color-picker builds stored sampled HEX values with a picker-specific hash,
        // then the clipboard watcher stored the same value again. Consolidate those rows.
        connection.execute_batch(
            r#"
            UPDATE clipboard_items AS item
            SET pinned = 1
            WHERE item.kind = 'color'
              AND item.deleted_at IS NULL
              AND EXISTS (
                SELECT 1 FROM clipboard_items AS duplicate
                WHERE duplicate.kind = 'color'
                  AND duplicate.deleted_at IS NULL
                  AND UPPER(duplicate.content) = UPPER(item.content)
                  AND duplicate.pinned = 1
              );

            DELETE FROM clipboard_items
            WHERE kind = 'color'
              AND deleted_at IS NULL
              AND id NOT IN (
                SELECT MAX(id)
                FROM clipboard_items
                WHERE kind = 'color' AND deleted_at IS NULL
                GROUP BY UPPER(content)
              );
            "#,
        )?;
        Ok(())
    }

    pub fn insert_snapshot(
        &self,
        snapshot: NewClipboardItem,
        history_limit: u32,
    ) -> AppResult<ClipboardItem> {
        let now = Utc::now().timestamp_millis();
        let mut connection = self.lock()?;
        let transaction = connection.transaction()?;
        transaction.execute(
            r#"
            INSERT INTO clipboard_items (kind, title, content, detail, byte_size, created_at, content_hash, source_app_id, source_app_name, ocr_status)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, CASE WHEN ?10 = 1 THEN 'pending' ELSE NULL END)
            ON CONFLICT(content_hash) DO UPDATE SET
                kind = excluded.kind,
                title = excluded.title,
                content = excluded.content,
                detail = excluded.detail,
                byte_size = excluded.byte_size,
                created_at = excluded.created_at,
                source_app_id = COALESCE(excluded.source_app_id, clipboard_items.source_app_id),
                source_app_name = COALESCE(excluded.source_app_name, clipboard_items.source_app_name),
                ocr_status = CASE WHEN excluded.ocr_status IS NOT NULL AND clipboard_items.ocr_text IS NULL THEN 'pending' ELSE clipboard_items.ocr_status END,
                deleted_at = NULL
            "#,
            params![
                snapshot.kind,
                snapshot.title,
                snapshot.content,
                snapshot.detail,
                snapshot.byte_size,
                now,
                snapshot.content_hash,
                snapshot.source_app_id,
                snapshot.source_app_name,
                snapshot
                    .representations
                    .iter()
                    .any(|value| value.format == "image") as i64
            ],
        )?;
        let item_id: i64 = transaction.query_row(
            "SELECT id FROM clipboard_items WHERE content_hash = ?1",
            params![snapshot.content_hash],
            |row| row.get(0),
        )?;
        transaction.execute(
            "DELETE FROM clipboard_representations WHERE item_id = ?1",
            params![item_id],
        )?;
        for representation in snapshot.representations {
            transaction.execute(
                "INSERT INTO clipboard_representations (item_id, item_index, format, content, byte_size, native_type, binary) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![item_id, representation.item_index, representation.format, representation.content, representation.byte_size, representation.native_type, representation.binary],
            )?;
        }
        transaction.commit()?;
        let mut item = connection.query_row(
            "SELECT id, kind, title, content, detail, byte_size, created_at, pinned, source_app_id, source_app_name, ocr_text, ocr_status, ocr_engine, ocr_confidence, ocr_has_formula FROM clipboard_items WHERE id = ?1",
            params![item_id],
            map_item,
        )?;
        attach_representations(&connection, std::slice::from_mut(&mut item))?;
        let stale_files = prune_count_locked(&connection, history_limit)?;
        drop(connection);
        remove_cached_files(stale_files);
        Ok(item)
    }

    pub fn list_items(&self, query: Option<&str>, limit: u32) -> AppResult<Vec<ClipboardItem>> {
        let connection = self.lock()?;
        let normalized = query.unwrap_or_default().trim();
        let mut items = Vec::new();

        if normalized.is_empty() {
            let mut statement = connection.prepare(
                "SELECT id, kind, title, content, detail, byte_size, created_at, pinned, source_app_id, source_app_name, ocr_text, ocr_status, ocr_engine, ocr_confidence, ocr_has_formula FROM clipboard_items WHERE deleted_at IS NULL ORDER BY pinned DESC, created_at DESC LIMIT ?1",
            )?;
            let rows = statement.query_map(params![limit], map_item)?;
            for row in rows {
                items.push(row?);
            }
        } else {
            let pattern = format!("%{normalized}%");
            let mut statement = connection.prepare(
                "SELECT id, kind, title, content, detail, byte_size, created_at, pinned, source_app_id, source_app_name, ocr_text, ocr_status, ocr_engine, ocr_confidence, ocr_has_formula FROM clipboard_items WHERE deleted_at IS NULL AND (title LIKE ?1 OR content LIKE ?1 OR detail LIKE ?1 OR source_app_name LIKE ?1 OR ocr_text LIKE ?1 OR EXISTS (SELECT 1 FROM clipboard_representations representation WHERE representation.item_id = clipboard_items.id AND representation.content LIKE ?1)) ORDER BY pinned DESC, created_at DESC LIMIT ?2",
            )?;
            let rows = statement.query_map(params![pattern, limit], map_item)?;
            for row in rows {
                items.push(row?);
            }
        }
        attach_representations(&connection, &mut items)?;
        Ok(items)
    }

    pub fn get_item(&self, id: i64) -> AppResult<ClipboardItem> {
        let connection = self.lock()?;
        let mut item = connection
            .query_row(
                "SELECT id, kind, title, content, detail, byte_size, created_at, pinned, source_app_id, source_app_name, ocr_text, ocr_status, ocr_engine, ocr_confidence, ocr_has_formula FROM clipboard_items WHERE id = ?1 AND deleted_at IS NULL",
                params![id],
                map_item,
            )
            .optional()?
            .ok_or(AppError::NotFound)?;
        attach_representations(&connection, std::slice::from_mut(&mut item))?;
        Ok(item)
    }

    pub fn toggle_pin(&self, id: i64) -> AppResult<ClipboardItem> {
        let connection = self.lock()?;
        let changed = connection.execute(
            "UPDATE clipboard_items SET pinned = CASE pinned WHEN 0 THEN 1 ELSE 0 END WHERE id = ?1 AND deleted_at IS NULL",
            params![id],
        )?;
        if changed == 0 {
            return Err(AppError::NotFound);
        }
        let mut item = connection.query_row(
            "SELECT id, kind, title, content, detail, byte_size, created_at, pinned, source_app_id, source_app_name, ocr_text, ocr_status, ocr_engine, ocr_confidence, ocr_has_formula FROM clipboard_items WHERE id = ?1",
            params![id],
            map_item,
        )?;
        attach_representations(&connection, std::slice::from_mut(&mut item))?;
        Ok(item)
    }

    pub fn delete_item(&self, id: i64) -> AppResult<bool> {
        let connection = self.lock()?;
        Ok(connection.execute(
            "UPDATE clipboard_items SET deleted_at = ?2 WHERE id = ?1 AND deleted_at IS NULL",
            params![id, Utc::now().timestamp_millis()],
        )? > 0)
    }

    pub fn clear_unpinned(&self) -> AppResult<Vec<i64>> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction()?;
        let ids = {
            let mut statement = transaction.prepare(
                "SELECT id FROM clipboard_items WHERE pinned = 0 AND deleted_at IS NULL",
            )?;
            let rows = statement
                .query_map([], |row| row.get::<_, i64>(0))?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            rows
        };
        transaction.execute(
            "UPDATE clipboard_items SET deleted_at = ?1 WHERE pinned = 0 AND deleted_at IS NULL",
            params![Utc::now().timestamp_millis()],
        )?;
        transaction.commit()?;
        Ok(ids)
    }

    pub fn restore_items(&self, ids: &[i64]) -> AppResult<u64> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction()?;
        let mut restored = 0;
        for id in ids {
            restored += transaction.execute(
                "UPDATE clipboard_items SET deleted_at = NULL WHERE id = ?1 AND deleted_at IS NOT NULL",
                params![id],
            )? as u64;
        }
        transaction.commit()?;
        Ok(restored)
    }

    pub fn cleanup(&self, settings: &AppSettings) -> AppResult<()> {
        let connection = self.lock()?;
        let mut files = prune_count_locked(&connection, settings.history_limit)?;
        let trash_cutoff = Utc::now().timestamp_millis() - 24 * 60 * 60 * 1_000;
        files.extend(image_paths_for(
            &connection,
            "item.deleted_at IS NOT NULL AND item.deleted_at < ?1",
            params![trash_cutoff],
        )?);
        connection.execute(
            "DELETE FROM clipboard_items WHERE deleted_at IS NOT NULL AND deleted_at < ?1",
            params![trash_cutoff],
        )?;
        if settings.retention_days > 0 {
            let cutoff = Utc::now().timestamp_millis()
                - i64::from(settings.retention_days) * 24 * 60 * 60 * 1_000;
            files.extend(image_paths_for(
                &connection,
                "item.pinned = 0 AND item.deleted_at IS NULL AND item.created_at < ?1",
                params![cutoff],
            )?);
            connection.execute(
                "DELETE FROM clipboard_items WHERE pinned = 0 AND deleted_at IS NULL AND created_at < ?1",
                params![cutoff],
            )?;
        }
        drop(connection);
        remove_cached_files(files);
        Ok(())
    }

    pub fn settings(&self) -> AppResult<AppSettings> {
        let connection = self.lock()?;
        let value: Option<String> = connection
            .query_row(
                "SELECT value FROM app_settings WHERE key = 'app'",
                [],
                |row| row.get(0),
            )
            .optional()?;
        Ok(value
            .and_then(|json| serde_json::from_str(&json).ok())
            .unwrap_or_default())
    }

    pub fn save_settings(&self, settings: &AppSettings) -> AppResult<()> {
        let connection = self.lock()?;
        let value = serde_json::to_string(settings).unwrap_or_else(|_| "{}".into());
        connection.execute(
            "INSERT INTO app_settings (key, value) VALUES ('app', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![value],
        )?;
        drop(connection);
        self.cleanup(settings)?;
        Ok(())
    }

    pub fn update_ocr(
        &self,
        id: i64,
        text: Option<&str>,
        status: &str,
        confidence: Option<f64>,
        has_formula: bool,
    ) -> AppResult<()> {
        let connection = self.lock()?;
        connection.execute(
            "UPDATE clipboard_items SET ocr_text = ?2, ocr_status = ?3, ocr_engine = 'PP-OCRv5 Mobile FP16', ocr_confidence = ?4, ocr_has_formula = ?5 WHERE id = ?1",
            params![id, text, status, confidence, has_formula as i64],
        )?;
        Ok(())
    }

    pub fn pending_ocr_images(&self, limit: u32) -> AppResult<Vec<(i64, Vec<String>)>> {
        let connection = self.lock()?;
        let mut statement = connection.prepare(
            "SELECT item.id, representation.content FROM clipboard_items item JOIN clipboard_representations representation ON representation.item_id = item.id AND representation.format = 'image' WHERE item.deleted_at IS NULL AND (item.ocr_status IS NULL OR item.ocr_status IN ('pending', 'failed')) ORDER BY item.created_at DESC, representation.item_index ASC, representation.id ASC",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut grouped = Vec::<(i64, Vec<String>)>::new();
        for row in rows {
            let (id, path) = row?;
            if let Some((_, paths)) = grouped.iter_mut().find(|(item_id, _)| *item_id == id) {
                paths.push(path);
            } else if grouped.len() < limit as usize {
                grouped.push((id, vec![path]));
            }
        }
        Ok(grouped)
    }

    fn lock(&self) -> AppResult<std::sync::MutexGuard<'_, Connection>> {
        self.connection
            .lock()
            .map_err(|_| AppError::Clipboard("database lock poisoned".into()))
    }
}

fn map_item(row: &Row<'_>) -> rusqlite::Result<ClipboardItem> {
    Ok(ClipboardItem {
        id: row.get(0)?,
        kind: row.get(1)?,
        title: row.get(2)?,
        content: row.get(3)?,
        detail: row.get(4)?,
        byte_size: row.get(5)?,
        created_at: row.get(6)?,
        pinned: row.get::<_, i64>(7)? != 0,
        source_app_id: row.get(8)?,
        source_app_name: row.get(9)?,
        ocr_text: row.get(10)?,
        ocr_status: row.get(11)?,
        ocr_engine: row.get(12)?,
        ocr_confidence: row.get(13)?,
        ocr_has_formula: row.get::<_, i64>(14)? != 0,
        missing_files: false,
        formats: Vec::new(),
        representations: Vec::new(),
    })
}

fn attach_representations(connection: &Connection, items: &mut [ClipboardItem]) -> AppResult<()> {
    let mut statement = connection.prepare(
        "SELECT item_index, format, content, byte_size, native_type, binary FROM clipboard_representations WHERE item_id = ?1 ORDER BY item_index, id",
    )?;
    for item in items {
        let rows = statement.query_map(params![item.id], |row| {
            Ok(ClipboardRepresentation {
                item_index: row.get(0)?,
                format: row.get(1)?,
                content: row.get(2)?,
                byte_size: row.get(3)?,
                native_type: row.get(4)?,
                binary: row.get::<_, i64>(5)? != 0,
            })
        })?;
        item.representations = rows.collect::<rusqlite::Result<Vec<_>>>()?;
        item.formats = item
            .representations
            .iter()
            .map(|representation| representation.format.clone())
            .collect();
        item.formats.sort();
        item.formats.dedup();
        item.missing_files = item
            .representations
            .iter()
            .any(representation_has_missing_file);
    }
    Ok(())
}

fn prune_count_locked(connection: &Connection, history_limit: u32) -> AppResult<Vec<String>> {
    let files = image_paths_for(
        connection,
        "item.pinned = 0 AND item.deleted_at IS NULL AND item.id NOT IN (SELECT id FROM clipboard_items WHERE deleted_at IS NULL ORDER BY pinned DESC, created_at DESC LIMIT ?1)",
        params![history_limit.max(10)],
    )?;
    connection.execute(
        r#"
        DELETE FROM clipboard_items
        WHERE pinned = 0 AND deleted_at IS NULL AND id NOT IN (
            SELECT id FROM clipboard_items WHERE deleted_at IS NULL ORDER BY pinned DESC, created_at DESC LIMIT ?1
        )
        "#,
        params![history_limit.max(10)],
    )?;
    Ok(files)
}

fn representation_has_missing_file(representation: &ClipboardRepresentation) -> bool {
    if representation.format != "files" {
        return false;
    }
    file_paths(&representation.content)
        .iter()
        .any(|path| !Path::new(path).exists())
}

fn file_paths(content: &str) -> Vec<String> {
    if let Ok(paths) = serde_json::from_str::<Vec<String>>(content) {
        return paths.into_iter().map(normalize_file_path).collect();
    }
    vec![normalize_file_path(content.to_string())]
}

fn normalize_file_path(value: String) -> String {
    value
        .strip_prefix("file://")
        .unwrap_or(&value)
        .replace("%20", " ")
}

fn image_paths_for<P>(connection: &Connection, condition: &str, params: P) -> AppResult<Vec<String>>
where
    P: rusqlite::Params,
{
    let mut statement = connection.prepare(&format!(
        "SELECT DISTINCT representation.content
         FROM clipboard_representations representation
         JOIN clipboard_items item ON item.id = representation.item_id
         WHERE representation.binary = 1 AND {condition}"
    ))?;
    let rows = statement.query_map(params, |row| row.get::<_, String>(0))?;
    let mut files = Vec::new();
    for row in rows {
        files.push(row?);
    }
    Ok(files)
}

fn remove_cached_files(files: Vec<String>) {
    for file in files {
        if std::path::Path::new(&file).is_absolute() {
            let _ = std::fs::remove_file(file);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Database;
    use crate::models::{ClipboardRepresentation, NewClipboardItem};

    fn text_snapshot(value: &str) -> NewClipboardItem {
        NewClipboardItem {
            kind: "text".into(),
            title: value.into(),
            content: value.into(),
            detail: "Text".into(),
            byte_size: None,
            content_hash: value.into(),
            source_app_id: None,
            source_app_name: None,
            representations: vec![ClipboardRepresentation {
                item_index: 0,
                format: "text".into(),
                content: value.into(),
                byte_size: None,
                native_type: None,
                binary: false,
            }],
        }
    }

    fn color_snapshot(value: &str, hash: &str) -> NewClipboardItem {
        let mut snapshot = text_snapshot(value);
        snapshot.kind = "color".into();
        snapshot.detail = "Color".into();
        snapshot.content_hash = hash.into();
        snapshot
    }

    #[test]
    fn persists_and_searches_items() {
        let database = Database::open(std::path::Path::new(":memory:")).unwrap();
        database
            .insert_snapshot(text_snapshot("https://mote.app"), 100)
            .unwrap();
        database
            .insert_snapshot(text_snapshot("fn main() {}"), 100)
            .unwrap();
        let results = database.list_items(Some("mote"), 100).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].formats, ["text"]);
    }

    #[test]
    fn preserves_compound_item_order_and_native_types() {
        let database = Database::open(std::path::Path::new(":memory:")).unwrap();
        let snapshot = NewClipboardItem {
            kind: "mixed".into(),
            title: "Compound clipping".into(),
            content: "First item".into(),
            detail: "2 items · Text + Image".into(),
            byte_size: Some("2 KB".into()),
            content_hash: "compound-hash".into(),
            source_app_id: None,
            source_app_name: None,
            representations: vec![
                ClipboardRepresentation {
                    item_index: 0,
                    format: "text".into(),
                    content: "First item".into(),
                    byte_size: None,
                    native_type: Some("public.utf8-plain-text".into()),
                    binary: false,
                },
                ClipboardRepresentation {
                    item_index: 1,
                    format: "image".into(),
                    content: "/tmp/compound.png".into(),
                    byte_size: Some("2 KB".into()),
                    native_type: Some("public.png".into()),
                    binary: true,
                },
            ],
        };
        let item = database.insert_snapshot(snapshot, 100).unwrap();

        assert_eq!(item.kind, "mixed");
        assert_eq!(item.representations.len(), 2);
        assert_eq!(item.representations[0].item_index, 0);
        assert_eq!(item.representations[1].item_index, 1);
        assert_eq!(
            item.representations[1].native_type.as_deref(),
            Some("public.png")
        );
        assert!(item.representations[1].binary);
    }

    #[test]
    fn deleted_items_can_be_restored() {
        let database = Database::open(std::path::Path::new(":memory:")).unwrap();
        let item = database
            .insert_snapshot(text_snapshot("undo me"), 100)
            .unwrap();
        assert!(database.delete_item(item.id).unwrap());
        assert!(database.list_items(None, 100).unwrap().is_empty());
        assert_eq!(database.restore_items(&[item.id]).unwrap(), 1);
        assert_eq!(database.list_items(None, 100).unwrap().len(), 1);
    }

    #[test]
    fn marks_missing_file_representations() {
        let database = Database::open(std::path::Path::new(":memory:")).unwrap();
        let mut snapshot = text_snapshot("missing file");
        snapshot.kind = "files".into();
        snapshot.representations = vec![ClipboardRepresentation {
            item_index: 0,
            format: "files".into(),
            content: "/definitely-not-a-real-mote-file.pdf".into(),
            byte_size: None,
            native_type: Some("public.file-url".into()),
            binary: false,
        }];
        let item = database.insert_snapshot(snapshot, 100).unwrap();
        assert!(item.missing_files);
    }

    #[test]
    fn lists_pending_ocr_images_in_representation_order() {
        let database = Database::open(std::path::Path::new(":memory:")).unwrap();
        let mut snapshot = text_snapshot("images to recognize");
        snapshot.kind = "mixed".into();
        snapshot.representations = vec![
            ClipboardRepresentation {
                item_index: 1,
                format: "image".into(),
                content: "/tmp/second.png".into(),
                byte_size: None,
                native_type: Some("public.png".into()),
                binary: true,
            },
            ClipboardRepresentation {
                item_index: 0,
                format: "image".into(),
                content: "/tmp/first.png".into(),
                byte_size: None,
                native_type: Some("public.png".into()),
                binary: true,
            },
        ];
        database.insert_snapshot(snapshot, 100).unwrap();

        let pending = database.pending_ocr_images(10).unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].1, ["/tmp/first.png", "/tmp/second.png"]);
    }

    #[test]
    fn consolidates_legacy_picker_and_watcher_color_rows() {
        let database = Database::open(std::path::Path::new(":memory:")).unwrap();
        let first = database
            .insert_snapshot(color_snapshot("#FE7A23", "legacy-picker-hash"), 100)
            .unwrap();
        database.toggle_pin(first.id).unwrap();
        database
            .insert_snapshot(color_snapshot("#FE7A23", "watcher-hash"), 100)
            .unwrap();

        database.migrate().unwrap();

        let colors = database.list_items(None, 100).unwrap();
        assert_eq!(colors.len(), 1);
        assert_eq!(colors[0].content, "#FE7A23");
        assert!(colors[0].pinned);
    }
}
