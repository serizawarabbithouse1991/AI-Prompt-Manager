use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::{params, Connection, OpenFlags};

use crate::db::connection::now_iso;
use crate::platform;
use crate::services::character_matcher::{expand_tag_candidates, normalize_tag};

pub const SETTING_DANBOORU_DB_PATH: &str = "danbooru_db_path";
pub const SETTING_CACHE_BUILT_AT: &str = "danbooru_cache_built_at";

pub const SKIP_CACHE_NOT_READY: &str = "cache_not_ready";

struct CharacterMemoryIndex {
    normalized: HashSet<String>,
    by_length_desc: Vec<String>,
}

static MEMORY_INDEX: Mutex<Option<CharacterMemoryIndex>> = Mutex::new(None);

pub fn invalidate_memory_index() {
    if let Ok(mut guard) = MEMORY_INDEX.lock() {
        *guard = None;
    }
}

fn load_memory_index(conn: &Connection) -> Result<(), String> {
    let mut normalized = HashSet::new();
    let mut stmt = conn
        .prepare("SELECT normalized FROM danbooru_character_tags")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    for row in rows {
        let tag = row.map_err(|e| e.to_string())?;
        normalized.insert(tag);
    }

    let mut by_length_desc: Vec<String> = normalized.iter().cloned().collect();
    by_length_desc.sort_by_key(|tag| std::cmp::Reverse(tag.len()));

    let mut guard = MEMORY_INDEX.lock().map_err(|e| e.to_string())?;
    *guard = Some(CharacterMemoryIndex {
        normalized,
        by_length_desc,
    });
    Ok(())
}

pub fn ensure_memory_index(conn: &Connection) -> Result<(), String> {
    let needs_load = MEMORY_INDEX
        .lock()
        .map_err(|e| e.to_string())?
        .is_none();
    if needs_load {
        load_memory_index(conn)?;
    }
    Ok(())
}

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT value FROM app_settings WHERE key = ?1",
        params![key],
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

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn resolve_danbooru_db_path(conn: &Connection, app_data: &Path) -> Result<PathBuf, String> {
    if let Some(path) = get_setting(conn, SETTING_DANBOORU_DB_PATH)? {
        let candidate = PathBuf::from(path);
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    let sandbox = app_data.join("danbooru2023.db");
    if sandbox.is_file() {
        return Ok(sandbox);
    }

    if let Ok(paths) = platform::get_special_paths(app_data) {
        if let Some(novel_ai) = paths.novel_ai {
            let candidate = PathBuf::from(novel_ai).join("danbooru2023.db");
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
    }

    Err(
        "Danbooru DB が見つかりません。設定でパスを指定するか、辞書ファイルをインポートしてください。"
            .to_string(),
    )
}

pub fn set_danbooru_db_path(conn: &Connection, path: &str) -> Result<(), String> {
    let candidate = PathBuf::from(path);
    if !candidate.is_file() {
        return Err(format!("ファイルが見つかりません: {path}"));
    }
    set_setting(conn, SETTING_DANBOORU_DB_PATH, path)
}

pub fn copy_danbooru_db_to_sandbox(app_data: &Path, source: &Path) -> Result<PathBuf, String> {
    if !source.is_file() {
        return Err(format!(
            "Danbooru DB が見つかりません: {}",
            source.display()
        ));
    }
    std::fs::create_dir_all(app_data).map_err(|e| e.to_string())?;
    let dest = app_data.join("danbooru2023.db");
    std::fs::copy(source, &dest).map_err(|e| e.to_string())?;
    Ok(dest)
}

pub fn import_danbooru_db(conn: &Connection, app_data: &Path, source: &Path) -> Result<PathBuf, String> {
    let dest = copy_danbooru_db_to_sandbox(app_data, source)?;
    set_setting(
        conn,
        SETTING_DANBOORU_DB_PATH,
        &dest.to_string_lossy(),
    )?;
    Ok(dest)
}

pub fn character_cache_count(conn: &Connection) -> Result<u32, String> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM danbooru_character_tags", [], |row| {
            row.get(0)
        })
        .map_err(|e| e.to_string())?;
    Ok(count as u32)
}

pub fn is_cache_ready(conn: &Connection) -> Result<bool, String> {
    Ok(character_cache_count(conn)? > 0)
}

/// キャッシュ未構築時は自動 rebuild せずエラーを返す（assign パスから 6GB 読み込みを分離）
pub fn require_cache_ready(conn: &Connection) -> Result<u32, String> {
    let count = character_cache_count(conn)?;
    if count == 0 {
        return Err(SKIP_CACHE_NOT_READY.to_string());
    }
    Ok(count)
}

pub fn rebuild_character_cache<F>(
    conn: &Connection,
    db_path: &Path,
    mut on_progress: Option<F>,
) -> Result<u32, String>
where
    F: FnMut(String, u32),
{
    if !db_path.is_file() {
        return Err(format!(
            "Danbooru DB が見つかりません: {}",
            db_path.display()
        ));
    }

    invalidate_memory_index();

    if let Some(ref mut progress) = on_progress {
        progress("opening".to_string(), 0);
    }

    let external = Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("Danbooru DB を開けません: {e}"))?;

    conn.execute("DELETE FROM danbooru_character_tags", [])
        .map_err(|e| e.to_string())?;

    let mut ext_stmt = external
        .prepare(
            "SELECT name FROM tag WHERE type = '2' OR type = 2 OR CAST(type AS TEXT) = '2'",
        )
        .map_err(|e| format!("Danbooru tag テーブルを読めません: {e}"))?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| e.to_string())?;
    let mut inserted = 0u32;
    {
        let mut insert = conn
            .prepare(
                "INSERT OR IGNORE INTO danbooru_character_tags (name, normalized) VALUES (?1, ?2)",
            )
            .map_err(|e| e.to_string())?;

        let rows = ext_stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;

        for row in rows {
            let name: String = row.map_err(|e| e.to_string())?;
            let normalized = normalize_tag(&name);
            if normalized.is_empty() {
                continue;
            }
            insert
                .execute(params![name, normalized])
                .map_err(|e| e.to_string())?;
            inserted += 1;
            if inserted % 10_000 == 0 {
                if let Some(ref mut progress) = on_progress {
                    progress("importing".to_string(), inserted);
                }
            }
        }
    }
    tx.commit().map_err(|e| e.to_string())?;

    let count = character_cache_count(conn)?;
    if count == 0 {
        return Err(
            "キャラクタータグを読み込めませんでした（tag テーブルを確認してください）".to_string(),
        );
    }

    set_setting(conn, SETTING_CACHE_BUILT_AT, &now_iso())?;
    set_setting(
        conn,
        SETTING_DANBOORU_DB_PATH,
        &db_path.to_string_lossy(),
    )?;
    load_memory_index(conn)?;

    if let Some(ref mut progress) = on_progress {
        progress("done".to_string(), count);
    }

    Ok(count)
}

pub fn is_character_tag(conn: &Connection, normalized: &str) -> Result<bool, String> {
    ensure_memory_index(conn)?;
    let guard = MEMORY_INDEX.lock().map_err(|e| e.to_string())?;
    Ok(guard
        .as_ref()
        .map(|index| index.normalized.contains(normalized))
        .unwrap_or(false))
}

pub fn find_characters_in_prompt(
    conn: &Connection,
    prompt: &str,
    tags: &[String],
) -> Result<Vec<String>, String> {
    if !is_cache_ready(conn)? {
        return Ok(Vec::new());
    }
    ensure_memory_index(conn)?;

    let guard = MEMORY_INDEX.lock().map_err(|e| e.to_string())?;
    let Some(index) = guard.as_ref() else {
        return Ok(Vec::new());
    };

    let mut matched = HashSet::new();
    let candidates = expand_tag_candidates(tags);

    for candidate in &candidates {
        if index.normalized.contains(candidate) {
            matched.insert(candidate.clone());
        }
    }

    let norm_prompt = normalize_tag(prompt);
    for tag in &index.by_length_desc {
        if tag.len() < 2 {
            continue;
        }
        if norm_prompt.contains(tag.as_str()) {
            matched.insert(tag.clone());
        }
    }

    let mut result: Vec<String> = matched.into_iter().collect();
    result.sort();
    Ok(result)
}

pub fn filter_character_tags(conn: &Connection, tags: &[String]) -> Result<Vec<String>, String> {
    if tags.is_empty() || !is_cache_ready(conn)? {
        return Ok(Vec::new());
    }

    let placeholders = std::iter::repeat("?")
        .take(tags.len())
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "SELECT normalized FROM danbooru_character_tags WHERE normalized IN ({placeholders}) OR name IN ({placeholders})"
    );

    let mut params: Vec<String> = tags.to_vec();
    params.extend(tags.iter().cloned());

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let sql_params: Vec<&dyn rusqlite::ToSql> = params
        .iter()
        .map(|tag| tag as &dyn rusqlite::ToSql)
        .collect();
    let rows = stmt
        .query_map(sql_params.as_slice(), |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    let mut matched = HashSet::new();
    for row in rows {
        matched.insert(row.map_err(|e| e.to_string())?);
    }

    let mut result: Vec<String> = matched.into_iter().collect();
    result.sort();
    Ok(result)
}

pub fn canonical_name_for_tag(conn: &Connection, normalized: &str) -> Result<String, String> {
    match conn.query_row(
        "SELECT name FROM danbooru_character_tags WHERE normalized = ?1 LIMIT 1",
        params![normalized],
        |row| row.get::<_, String>(0),
    ) {
        Ok(name) => Ok(name),
        Err(_) => Ok(normalized.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_cache(conn: &Connection) {
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS danbooru_character_tags (
              name TEXT PRIMARY KEY,
              normalized TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS app_settings (
              key TEXT PRIMARY KEY,
              value TEXT
            );
            INSERT OR IGNORE INTO danbooru_character_tags (name, normalized)
            VALUES ('hatsune_miku', 'hatsune miku'), ('solo', 'solo');
            "#,
        )
        .unwrap();
        invalidate_memory_index();
    }

    #[test]
    fn find_characters_uses_partial_match() {
        let conn = Connection::open_in_memory().unwrap();
        setup_cache(&conn);
        let tags = tokenize_for_test("1girl, masterpiece");
        let matched =
            find_characters_in_prompt(&conn, "1girl, hatsune miku, masterpiece", &tags).unwrap();
        assert!(matched.contains(&"hatsune miku".to_string()));
    }

    #[test]
    fn require_cache_ready_fails_when_empty() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS danbooru_character_tags (name TEXT PRIMARY KEY, normalized TEXT NOT NULL UNIQUE);",
        )
        .unwrap();
        assert_eq!(
            require_cache_ready(&conn).unwrap_err(),
            SKIP_CACHE_NOT_READY
        );
    }

    fn tokenize_for_test(prompt: &str) -> Vec<String> {
        use crate::services::character_matcher::tokenize_prompt;
        tokenize_prompt(prompt)
    }
}
