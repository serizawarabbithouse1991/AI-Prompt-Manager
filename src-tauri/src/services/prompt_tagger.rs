use rusqlite::{params, Connection};

use crate::db::repositories::app_settings::{get_setting, set_setting};
use crate::db::repositories::tags as tags_repo;
use crate::models::prompt_tag::{BatchTagApplyResult, PromptTagSettings, TagApplyResult};
use crate::services::character_matcher::{
    filter_quality_tags, is_quality_tag, normalize_tag, tokenize_prompt, SKIP_NO_PROMPT,
};
use crate::services::prompt_character_tags::find_characters_in_prompt;

pub const SETTING_PROMPT_TAG_MODE: &str = "prompt_tag_mode";
pub const SETTING_AUTO_TAG_ON_IMPORT: &str = "auto_tag_on_import";
pub const SETTING_EXCLUDE_QUALITY_TAGS: &str = "exclude_quality_tags";

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
    let exclude_raw = get_setting(conn, SETTING_EXCLUDE_QUALITY_TAGS)?
        .unwrap_or_else(|| "true".to_string());
    Ok(PromptTagSettings {
        mode,
        auto_tag_on_import: auto_raw != "false",
        exclude_quality_tags: exclude_raw != "false",
    })
}

pub fn set_prompt_tag_settings(
    conn: &Connection,
    mode: &str,
    auto_tag_on_import: bool,
    exclude_quality_tags: bool,
) -> Result<(), String> {
    let mode = if mode == "character" { "character" } else { "all" };
    set_setting(conn, SETTING_PROMPT_TAG_MODE, mode)?;
    set_setting(
        conn,
        SETTING_AUTO_TAG_ON_IMPORT,
        if auto_tag_on_import { "true" } else { "false" },
    )?;
    set_setting(
        conn,
        SETTING_EXCLUDE_QUALITY_TAGS,
        if exclude_quality_tags { "true" } else { "false" },
    )?;
    Ok(())
}

fn prune_auto_quality_tags(conn: &Connection, file_id: &str) -> Result<u32, String> {
    let tags = tags_repo::get_file_tags(conn, file_id)?;
    let mut removed = 0u32;
    for tag in tags {
        if tag.kind != "auto" {
            continue;
        }
        if is_quality_tag(&normalize_tag(&tag.name)) {
            tags_repo::remove_tag_from_file(conn, file_id, &tag.id)?;
            removed += 1;
        }
    }
    Ok(removed)
}

pub fn resolve_tags(
    conn: &Connection,
    prompt: &str,
    mode: PromptTagMode,
    exclude_quality: bool,
) -> Result<Vec<String>, String> {
    match mode {
        PromptTagMode::All => {
            let tokens = tokenize_prompt(prompt);
            if exclude_quality {
                Ok(filter_quality_tags(tokens))
            } else {
                Ok(tokens)
            }
        }
        PromptTagMode::Character => {
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

    let exclude_quality = get_prompt_tag_settings(conn)
        .map(|s| s.exclude_quality_tags)
        .unwrap_or(true);

    let _tags_pruned = if exclude_quality {
        prune_auto_quality_tags(conn, file_id)?
    } else {
        0
    };

    let tag_names = resolve_tags(conn, &prompt, mode, exclude_quality)?;

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

    let exclude_quality = get_prompt_tag_settings(conn)
        .map(|s| s.exclude_quality_tags)
        .unwrap_or(true);

    let mut result = BatchTagApplyResult::default();
    result.files_processed = rows.len() as u32;

    for (file_id, absolute_path, prompt) in rows {
        let Some(prompt) = prompt.filter(|p| !p.trim().is_empty()) else {
            result.files_without_prompt += 1;
            continue;
        };

        let _tags_pruned = if exclude_quality {
            prune_auto_quality_tags(conn, &file_id)?
        } else {
            0
        };

        let tag_names = resolve_tags(conn, &prompt, mode, exclude_quality)?;
        if tag_names.is_empty() && _tags_pruned == 0 {
            continue;
        }

        let (added, skipped) = if tag_names.is_empty() {
            (0, 0)
        } else {
            tags_repo::add_auto_tags_to_file(conn, &file_id, &absolute_path, &tag_names)?
        };
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
            CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE collections (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT,
              kind TEXT DEFAULT 'manual',
              created_at TEXT,
              match_keywords TEXT
            );
            INSERT INTO files (id, absolute_path, display_name, file_kind)
            VALUES ('f1', '/tmp/test.png', 'test.png', 'image');
            INSERT INTO ai_generation_metadata (file_id, positive_prompt)
            VALUES ('f1', 'character:hatsune miku, 1girl, masterpiece');
            INSERT INTO collections (id, name, kind, created_at, match_keywords)
            VALUES ('c1', 'Miku', 'smart_character', 'now', '["hatsune miku"]');
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

    fn tag_exists(conn: &Connection, name: &str) -> bool {
        conn.query_row(
            "SELECT 1 FROM tags WHERE name = ?1 LIMIT 1",
            params![name],
            |_| Ok(()),
        )
        .is_ok()
    }

    #[test]
    fn all_mode_excludes_quality_tags_by_default() {
        let conn = Connection::open_in_memory().unwrap();
        setup_db(&conn);
        apply_prompt_tags_for_file(&conn, "f1", "/tmp/test.png", PromptTagMode::All).unwrap();
        assert!(tag_exists(&conn, "1girl"));
        assert!(tag_exists(&conn, "hatsune miku"));
        assert!(!tag_exists(&conn, "masterpiece"));
    }

    #[test]
    fn all_mode_keeps_quality_when_disabled() {
        let conn = Connection::open_in_memory().unwrap();
        setup_db(&conn);
        set_prompt_tag_settings(&conn, "all", true, false).unwrap();
        apply_prompt_tags_for_file(&conn, "f1", "/tmp/test.png", PromptTagMode::All).unwrap();
        assert!(tag_exists(&conn, "masterpiece"));
    }

    fn file_has_tag(conn: &Connection, file_id: &str, name: &str) -> bool {
        tags_repo::get_file_tags(conn, file_id)
            .map(|tags| tags.iter().any(|t| t.name == name))
            .unwrap_or(false)
    }

    #[test]
    fn apply_prunes_existing_auto_quality_tags() {
        let conn = Connection::open_in_memory().unwrap();
        setup_db(&conn);
        let masterpiece = tags_repo::get_or_create_tag(&conn, "masterpiece", "auto").unwrap();
        tags_repo::add_tag_to_file(&conn, "f1", &masterpiece.id).unwrap();
        assert!(file_has_tag(&conn, "f1", "masterpiece"));

        apply_prompt_tags_for_file(&conn, "f1", "/tmp/test.png", PromptTagMode::All).unwrap();

        assert!(!file_has_tag(&conn, "f1", "masterpiece"));
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
