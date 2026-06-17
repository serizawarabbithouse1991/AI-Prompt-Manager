use rusqlite::{params, Connection};

use crate::db::repositories::tags as tags_repo;
use crate::models::prompt_tag::{BatchTagApplyResult, PromptTagSettings, TagApplyResult};
use crate::services::character_matcher::{tokenize_prompt, SKIP_NO_PROMPT};
use crate::services::danbooru_index::{
    find_characters_in_prompt, get_setting, is_cache_ready, set_setting,
    SKIP_CACHE_NOT_READY,
};

pub const SETTING_PROMPT_TAG_MODE: &str = "prompt_tag_mode";
pub const SETTING_AUTO_TAG_ON_IMPORT: &str = "auto_tag_on_import";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PromptTagMode {
    All,
    Character,
}

impl PromptTagMode {
    pub fn from_setting(value: &str) -> Self {
        if value == "character" {
            Self::Character
        } else {
            Self::All
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::All => "all",
            Self::Character => "character",
        }
    }
}

pub fn get_prompt_tag_settings(conn: &Connection) -> Result<PromptTagSettings, String> {
    let mode = get_setting(conn, SETTING_PROMPT_TAG_MODE)?
        .unwrap_or_else(|| "all".to_string());
    let auto_raw = get_setting(conn, SETTING_AUTO_TAG_ON_IMPORT)?
        .unwrap_or_else(|| "true".to_string());
    Ok(PromptTagSettings {
        mode,
        auto_tag_on_import: auto_raw != "false",
    })
}

pub fn set_prompt_tag_settings(
    conn: &Connection,
    mode: &str,
    auto_tag_on_import: bool,
) -> Result<(), String> {
    let mode = if mode == "character" { "character" } else { "all" };
    set_setting(conn, SETTING_PROMPT_TAG_MODE, mode)?;
    set_setting(
        conn,
        SETTING_AUTO_TAG_ON_IMPORT,
        if auto_tag_on_import { "true" } else { "false" },
    )?;
    Ok(())
}

pub fn resolve_tags(
    conn: &Connection,
    prompt: &str,
    mode: PromptTagMode,
) -> Result<Vec<String>, String> {
    match mode {
        PromptTagMode::All => Ok(tokenize_prompt(prompt)),
        PromptTagMode::Character => {
            if !is_cache_ready(conn)? {
                return Err(SKIP_CACHE_NOT_READY.to_string());
            }
            let tokens = tokenize_prompt(prompt);
            find_characters_in_prompt(conn, prompt, &tokens)
        }
    }
}

fn load_prompt_for_file(conn: &Connection, file_id: &str) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT positive_prompt FROM ai_generation_metadata WHERE file_id = ?1 LIMIT 1",
        params![file_id],
        |row| row.get(0),
    )
    .map(Some)
    .or_else(|e| {
        if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
            Ok(None)
        } else {
            Err(e.to_string())
        }
    })
}

pub fn apply_prompt_tags_for_file(
    conn: &Connection,
    file_id: &str,
    absolute_path: &str,
    mode: PromptTagMode,
) -> Result<TagApplyResult, String> {
    let Some(prompt) = load_prompt_for_file(conn, file_id)? else {
        return Ok(TagApplyResult {
            skip_reason: Some(SKIP_NO_PROMPT.to_string()),
            ..TagApplyResult::default()
        });
    };
    if prompt.trim().is_empty() {
        return Ok(TagApplyResult {
            skip_reason: Some(SKIP_NO_PROMPT.to_string()),
            ..TagApplyResult::default()
        });
    }

    let tag_names = match resolve_tags(conn, &prompt, mode) {
        Ok(names) => names,
        Err(reason) if reason == SKIP_CACHE_NOT_READY => {
            return Ok(TagApplyResult {
                skip_reason: Some(SKIP_CACHE_NOT_READY.to_string()),
                ..TagApplyResult::default()
            });
        }
        Err(e) => return Err(e),
    };

    if tag_names.is_empty() {
        return Ok(TagApplyResult::default());
    }

    let (tags_added, tags_skipped) =
        tags_repo::add_auto_tags_to_file(conn, file_id, absolute_path, &tag_names)?;

    Ok(TagApplyResult {
        tags_added,
        tags_skipped,
        skip_reason: None,
    })
}

pub fn batch_apply_prompt_tags(
    conn: &Connection,
    mode: PromptTagMode,
    file_ids: Option<&[String]>,
) -> Result<BatchTagApplyResult, String> {
    if mode == PromptTagMode::Character && !is_cache_ready(conn)? {
        return Ok(BatchTagApplyResult {
            skip_reason: Some(SKIP_CACHE_NOT_READY.to_string()),
            ..BatchTagApplyResult::default()
        });
    }

    let rows: Vec<(String, String, Option<String>)> = if let Some(ids) = file_ids {
        if ids.is_empty() {
            return Ok(BatchTagApplyResult::default());
        }
        let placeholders = std::iter::repeat("?")
            .take(ids.len())
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!(
            r#"
            SELECT f.id, f.absolute_path, m.positive_prompt
            FROM files f
            LEFT JOIN ai_generation_metadata m ON m.file_id = f.id
            WHERE f.is_deleted = 0 AND f.is_directory = 0 AND f.id IN ({placeholders})
            "#
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let params: Vec<&dyn rusqlite::ToSql> = ids
            .iter()
            .map(|id| id as &dyn rusqlite::ToSql)
            .collect();
        let mapped = stmt
            .query_map(params.as_slice(), |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(|e| e.to_string())?;
        mapped.filter_map(|r| r.ok()).collect()
    } else {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT f.id, f.absolute_path, m.positive_prompt
                FROM files f
                LEFT JOIN ai_generation_metadata m ON m.file_id = f.id
                WHERE f.is_deleted = 0 AND f.is_directory = 0
                "#,
            )
            .map_err(|e| e.to_string())?;
        let mapped = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .map_err(|e| e.to_string())?;
        mapped.filter_map(|r| r.ok()).collect()
    };

    let mut result = BatchTagApplyResult::default();
    result.files_processed = rows.len() as u32;

    for (file_id, absolute_path, prompt) in rows {
        let Some(prompt) = prompt.filter(|p| !p.trim().is_empty()) else {
            result.files_without_prompt += 1;
            continue;
        };

        let tag_names = resolve_tags(conn, &prompt, mode)?;
        if tag_names.is_empty() {
            continue;
        }

        let (added, skipped) =
            tags_repo::add_auto_tags_to_file(conn, &file_id, &absolute_path, &tag_names)?;
        result.tags_added += added;
        result.tags_skipped += skipped;
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_db(conn: &Connection) {
        conn.execute_batch(
            r#"
            CREATE TABLE files (
              id TEXT PRIMARY KEY,
              parent_id TEXT,
              absolute_path TEXT NOT NULL UNIQUE,
              display_name TEXT NOT NULL,
              extension TEXT,
              mime_type TEXT,
              file_kind TEXT NOT NULL,
              size_bytes INTEGER DEFAULT 0,
              width INTEGER,
              height INTEGER,
              created_at TEXT,
              modified_at TEXT,
              indexed_at TEXT,
              content_hash TEXT,
              perceptual_hash TEXT,
              is_directory INTEGER DEFAULT 0,
              is_hidden INTEGER DEFAULT 0,
              is_favorite INTEGER DEFAULT 0,
              is_deleted INTEGER DEFAULT 0,
              local_only INTEGER DEFAULT 1,
              remote_object_path TEXT
            );
            CREATE TABLE tags (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL UNIQUE,
              color TEXT,
              kind TEXT DEFAULT 'user',
              created_at TEXT
            );
            CREATE TABLE file_tags (
              file_id TEXT NOT NULL,
              tag_id TEXT NOT NULL,
              PRIMARY KEY(file_id, tag_id)
            );
            CREATE TABLE ai_generation_metadata (
              file_id TEXT PRIMARY KEY,
              positive_prompt TEXT
            );
            CREATE TABLE danbooru_character_tags (
              name TEXT PRIMARY KEY,
              normalized TEXT NOT NULL UNIQUE
            );
            CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT);
            INSERT INTO files (id, absolute_path, display_name, file_kind)
            VALUES ('f1', '/tmp/test.png', 'test.png', 'image');
            INSERT INTO ai_generation_metadata (file_id, positive_prompt)
            VALUES ('f1', '1girl, hatsune miku, masterpiece');
            "#,
        )
        .unwrap();
    }

    #[test]
    fn all_mode_adds_token_tags() {
        let conn = Connection::open_in_memory().unwrap();
        setup_db(&conn);
        let result = apply_prompt_tags_for_file(
            &conn,
            "f1",
            "/tmp/test.png",
            PromptTagMode::All,
        )
        .unwrap();
        assert!(result.tags_added >= 2);
        assert!(result.skip_reason.is_none());
    }

    #[test]
    fn duplicate_run_skips_existing() {
        let conn = Connection::open_in_memory().unwrap();
        setup_db(&conn);
        let first = apply_prompt_tags_for_file(
            &conn,
            "f1",
            "/tmp/test.png",
            PromptTagMode::All,
        )
        .unwrap();
        assert!(first.tags_added > 0);
        let second = apply_prompt_tags_for_file(
            &conn,
            "f1",
            "/tmp/test.png",
            PromptTagMode::All,
        )
        .unwrap();
        assert_eq!(second.tags_added, 0);
        assert!(second.tags_skipped > 0);
    }

    #[test]
    fn no_prompt_returns_skip_reason() {
        let conn = Connection::open_in_memory().unwrap();
        setup_db(&conn);
        conn.execute("DELETE FROM ai_generation_metadata", []).unwrap();
        let result = apply_prompt_tags_for_file(
            &conn,
            "f1",
            "/tmp/test.png",
            PromptTagMode::All,
        )
        .unwrap();
        assert_eq!(result.skip_reason.as_deref(), Some(SKIP_NO_PROMPT));
    }
}
