use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OpenFlags};

use crate::db::connection::now_iso;
use crate::platform;
use crate::services::character_matcher::normalize_tag;

pub const SETTING_DANBOORU_DB_PATH: &str = "danbooru_db_path";
pub const SETTING_CACHE_BUILT_AT: &str = "danbooru_cache_built_at";

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

pub fn rebuild_character_cache(conn: &Connection, db_path: &Path) -> Result<u32, String> {
    if !db_path.is_file() {
        return Err(format!(
            "Danbooru DB が見つかりません: {}",
            db_path.display()
        ));
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
        }
    }
    tx.commit().map_err(|e| e.to_string())?;

    let count = character_cache_count(conn)?;
    set_setting(conn, SETTING_CACHE_BUILT_AT, &now_iso())?;
    set_setting(
        conn,
        SETTING_DANBOORU_DB_PATH,
        &db_path.to_string_lossy(),
    )?;
    Ok(count)
}

pub fn ensure_cache_ready(conn: &Connection, app_data: &Path) -> Result<(), String> {
    if is_cache_ready(conn)? {
        return Ok(());
    }
    let path = resolve_danbooru_db_path(conn, app_data)?;
    rebuild_character_cache(conn, &path)?;
    Ok(())
}

pub fn is_character_tag(conn: &Connection, normalized: &str) -> Result<bool, String> {
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM danbooru_character_tags WHERE normalized = ?1",
            params![normalized],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(exists > 0)
}

pub fn filter_character_tags(conn: &Connection, tags: &[String]) -> Result<Vec<String>, String> {
    if tags.is_empty() {
        return Ok(Vec::new());
    }

    let placeholders = std::iter::repeat("?")
        .take(tags.len())
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "SELECT normalized FROM danbooru_character_tags WHERE normalized IN ({placeholders})"
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params: Vec<&dyn rusqlite::ToSql> = tags
        .iter()
        .map(|tag| tag as &dyn rusqlite::ToSql)
        .collect();
    let rows = stmt
        .query_map(params.as_slice(), |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    let mut matched = Vec::new();
    for row in rows {
        matched.push(row.map_err(|e| e.to_string())?);
    }
    matched.sort();
    matched.dedup();
    Ok(matched)
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
    }

    #[test]
    fn filter_character_tags_returns_only_cached_characters() {
        let conn = Connection::open_in_memory().unwrap();
        setup_cache(&conn);
        let tags = vec![
            "hatsune miku".to_string(),
            "solo".to_string(),
            "masterpiece".to_string(),
        ];
        let matched = filter_character_tags(&conn, &tags).unwrap();
        assert_eq!(matched, vec!["hatsune miku".to_string(), "solo".to_string()]);
    }

    #[test]
    fn is_character_tag_checks_cache() {
        let conn = Connection::open_in_memory().unwrap();
        setup_cache(&conn);
        assert!(is_character_tag(&conn, "hatsune miku").unwrap());
        assert!(!is_character_tag(&conn, "masterpiece").unwrap());
    }
}
