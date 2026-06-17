use rusqlite::{params, Connection, Row};

use crate::db::connection::now_iso;
use crate::models::file::{detect_file_kind, detect_mime, FileEntry};
use crate::services::hash::path_to_id;
use crate::services::library_reconcile::{ai_library_path_patterns, normalize_storage_path};

pub(crate) fn row_to_file(row: &Row) -> Result<FileEntry, rusqlite::Error> {
    Ok(FileEntry {
        id: row.get("id")?,
        parent_id: row.get("parent_id")?,
        absolute_path: row.get("absolute_path")?,
        display_name: row.get("display_name")?,
        extension: row.get("extension")?,
        mime_type: row.get("mime_type")?,
        file_kind: row.get("file_kind")?,
        size_bytes: row.get("size_bytes")?,
        width: row.get("width")?,
        height: row.get("height")?,
        created_at: row.get("created_at")?,
        modified_at: row.get("modified_at")?,
        indexed_at: row.get("indexed_at")?,
        content_hash: row.get("content_hash")?,
        is_directory: row.get::<_, i64>("is_directory")? != 0,
        is_hidden: row.get::<_, i64>("is_hidden")? != 0,
        is_favorite: row.get::<_, i64>("is_favorite")? != 0,
        is_deleted: row.get::<_, i64>("is_deleted")? != 0,
        thumbnail_path: None,
        tag_ids: Vec::new(),
        ai_model: None,
        ai_steps: None,
        prompt_preview: None,
    })
}

pub fn upsert_file(conn: &Connection, entry: &FileEntry) -> Result<(), String> {
    conn.execute(
        r#"
        INSERT INTO files (
          id, parent_id, absolute_path, display_name, extension, mime_type, file_kind,
          size_bytes, width, height, created_at, modified_at, indexed_at, content_hash,
          is_directory, is_hidden, is_favorite, is_deleted, local_only
        ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,1)
        ON CONFLICT(absolute_path) DO UPDATE SET
          display_name=excluded.display_name,
          extension=excluded.extension,
          mime_type=excluded.mime_type,
          file_kind=excluded.file_kind,
          size_bytes=excluded.size_bytes,
          width=excluded.width,
          height=excluded.height,
          modified_at=excluded.modified_at,
          indexed_at=excluded.indexed_at,
          content_hash=excluded.content_hash,
          is_directory=excluded.is_directory,
          is_hidden=excluded.is_hidden,
          is_deleted=0
        "#,
        params![
            entry.id,
            entry.parent_id,
            entry.absolute_path,
            entry.display_name,
            entry.extension,
            entry.mime_type,
            entry.file_kind,
            entry.size_bytes,
            entry.width,
            entry.height,
            entry.created_at,
            entry.modified_at,
            entry.indexed_at,
            entry.content_hash,
            entry.is_directory as i64,
            entry.is_hidden as i64,
            entry.is_favorite as i64,
            entry.is_deleted as i64,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn file_from_path(conn: &Connection, path: &str) -> Result<Option<FileEntry>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT * FROM files WHERE absolute_path = ?1 AND is_deleted = 0 LIMIT 1",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![path]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        return Ok(Some(row_to_file(&row).map_err(|e| e.to_string())?));
    }
    Ok(None)
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<FileEntry>, String> {
    let mut stmt = conn
        .prepare("SELECT * FROM files WHERE id = ?1 AND is_deleted = 0 LIMIT 1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![id]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        return Ok(Some(row_to_file(&row).map_err(|e| e.to_string())?));
    }
    Ok(None)
}

pub fn find_active_by_content_hash(
    conn: &Connection,
    content_hash: &str,
) -> Result<Option<FileEntry>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT * FROM files WHERE content_hash = ?1 AND is_deleted = 0 AND is_directory = 0 LIMIT 1",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(params![content_hash])
        .map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        return Ok(Some(row_to_file(&row).map_err(|e| e.to_string())?));
    }
    Ok(None)
}

pub fn list_favorites(conn: &Connection) -> Result<Vec<FileEntry>, String> {
    let mut stmt = conn
        .prepare("SELECT * FROM files WHERE is_favorite = 1 AND is_deleted = 0 ORDER BY display_name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row_to_file(row))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn count_ai_library(conn: &Connection, ai_library_prefix: &str) -> Result<u32, String> {
    let patterns = ai_library_path_patterns(ai_library_prefix);
    if patterns.is_empty() {
        return Ok(0);
    }
    let clause = patterns
        .iter()
        .map(|_| "absolute_path LIKE ?")
        .collect::<Vec<_>>()
        .join(" OR ");
    let sql = format!(
        "SELECT COUNT(DISTINCT id) FROM files WHERE ({clause}) AND is_deleted = 0 AND is_directory = 0"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params: Vec<&str> = patterns.iter().map(String::as_str).collect();
    stmt.query_row(rusqlite::params_from_iter(params), |row| row.get(0))
        .map_err(|e| e.to_string())
}

pub fn find_active_by_path_variants(
    conn: &Connection,
    path: &std::path::Path,
) -> Result<Option<FileEntry>, String> {
    let path_str = path.to_string_lossy();
    let mut candidates = vec![path_str.to_string()];
    let normalized = normalize_storage_path(&path_str);
    if normalized != path_str {
        candidates.push(normalized.clone());
    }
    if !path_str.starts_with("/private") {
        candidates.push(format!("/private{path_str}"));
    }

    for candidate in candidates {
        if let Some(entry) = file_from_path(conn, &candidate)? {
            return Ok(Some(entry));
        }
    }
    Ok(None)
}

pub fn list_ai_library(conn: &Connection, ai_library_prefix: &str) -> Result<Vec<FileEntry>, String> {
    let patterns = ai_library_path_patterns(ai_library_prefix);
    let mut by_id: std::collections::HashMap<String, FileEntry> = std::collections::HashMap::new();

    for pattern in patterns {
        let mut stmt = conn
            .prepare(
                "SELECT * FROM files WHERE absolute_path LIKE ?1 AND is_deleted = 0 AND is_directory = 0 ORDER BY display_name",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![pattern], |row| row_to_file(row))
            .map_err(|e| e.to_string())?;
        for row in rows {
            let entry = row.map_err(|e| e.to_string())?;
            by_id.entry(entry.id.clone()).or_insert(entry);
        }
    }

    let mut files: Vec<FileEntry> = by_id.into_values().collect();
    files.sort_by(|a, b| a.display_name.to_lowercase().cmp(&b.display_name.to_lowercase()));
    Ok(files)
}

pub fn get_file_tag_ids(conn: &Connection, file_id: &str) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT tag_id FROM file_tags WHERE file_id = ?1 ORDER BY tag_id")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![file_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn ensure_file_by_path(conn: &Connection, path: &str) -> Result<FileEntry, String> {
    if let Some(entry) = file_from_path(conn, path)? {
        return Ok(entry);
    }
    let entry = build_entry_from_metadata(std::path::Path::new(path), None, None)?;
    upsert_file(conn, &entry)?;
    Ok(entry)
}

pub fn merge_db_info(conn: &Connection, entries: &mut [FileEntry]) -> Result<(), String> {
    for entry in entries.iter_mut() {
        if let Some(db_entry) = file_from_path(conn, &entry.absolute_path)? {
            entry.is_favorite = db_entry.is_favorite;
            entry.id = db_entry.id;
        }
        entry.tag_ids = get_file_tag_ids(conn, &entry.id)?;
    }
    Ok(())
}

pub fn attach_db_metadata(conn: &Connection, files: &mut [FileEntry]) -> Result<(), String> {
    merge_db_info(conn, files)?;
    attach_thumbnail_paths(conn, files)?;
    attach_ai_summaries(conn, files)
}

pub fn attach_ai_summaries(conn: &Connection, files: &mut [FileEntry]) -> Result<(), String> {
    for file in files.iter_mut() {
        if file.is_directory {
            continue;
        }
        let result: Option<(Option<String>, Option<i64>, Option<String>)> = conn
            .query_row(
                "SELECT model, steps, positive_prompt FROM ai_generation_metadata WHERE file_id = ?1 LIMIT 1",
                params![file.id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .ok();
        if let Some((model, steps, prompt)) = result {
            file.ai_model = model;
            file.ai_steps = steps;
            file.prompt_preview = prompt.map(|p| {
                let trimmed = p.trim();
                if trimmed.chars().count() > 80 {
                    format!("{}…", trimmed.chars().take(80).collect::<String>())
                } else {
                    trimmed.to_string()
                }
            });
        }
    }
    Ok(())
}

pub fn set_favorite_with_upsert(
    conn: &Connection,
    file_id: &str,
    absolute_path: &str,
    is_favorite: bool,
) -> Result<(), String> {
    let changed = conn
        .execute(
            "UPDATE files SET is_favorite = ?1 WHERE id = ?2",
            params![is_favorite as i64, file_id],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        let mut entry = ensure_file_by_path(conn, absolute_path)?;
        entry.is_favorite = is_favorite;
        upsert_file(conn, &entry)?;
    }
    Ok(())
}

pub fn set_favorite(conn: &Connection, file_id: &str, is_favorite: bool) -> Result<(), String> {
    conn.execute(
        "UPDATE files SET is_favorite = ?1 WHERE id = ?2",
        params![is_favorite as i64, file_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn mark_deleted(conn: &Connection, path: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE files SET is_deleted = 1 WHERE absolute_path = ?1",
        params![path],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update_path(
    conn: &Connection,
    old_path: &str,
    new_path: &str,
    new_name: &str,
) -> Result<FileEntry, String> {
    let new_id = path_to_id(new_path);
    conn.execute(
        "UPDATE files SET id = ?1, absolute_path = ?2, display_name = ?3 WHERE absolute_path = ?4",
        params![new_id, new_path, new_name, old_path],
    )
    .map_err(|e| e.to_string())?;
    get_by_id(conn, &new_id)?.ok_or_else(|| "File not found after rename".to_string())
}

pub fn build_entry_from_metadata(
    path: &std::path::Path,
    width: Option<i64>,
    height: Option<i64>,
) -> Result<FileEntry, String> {
    let absolute_path = path.to_string_lossy().to_string();
    let display_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| absolute_path.clone());
    let extension = path
        .extension()
        .map(|e| e.to_string_lossy().to_string());
    let metadata = std::fs::metadata(path).map_err(|e| e.to_string())?;
    let is_directory = metadata.is_dir();
    let ext = extension.clone().unwrap_or_default();
    let file_kind = detect_file_kind(&ext, is_directory);
    let modified_at = metadata
        .modified()
        .ok()
        .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339());
    let created_at = metadata
        .created()
        .ok()
        .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339());

    Ok(FileEntry {
        id: path_to_id(&absolute_path),
        parent_id: path
            .parent()
            .map(|p| path_to_id(&p.to_string_lossy())),
        absolute_path,
        display_name: display_name.clone(),
        extension: extension.clone(),
        mime_type: extension.as_deref().and_then(detect_mime),
        file_kind,
        size_bytes: metadata.len() as i64,
        width,
        height,
        created_at,
        modified_at: modified_at.clone(),
        indexed_at: Some(now_iso()),
        content_hash: None,
        is_directory,
        is_hidden: display_name.starts_with('.'),
        is_favorite: false,
        is_deleted: false,
        thumbnail_path: None,
        tag_ids: Vec::new(),
        ai_model: None,
        ai_steps: None,
        prompt_preview: None,
    })
}

pub fn attach_thumbnail_paths(conn: &Connection, files: &mut [FileEntry]) -> Result<(), String> {
    for file in files.iter_mut() {
        if file.is_directory {
            continue;
        }
        let thumb: Option<String> = conn
            .query_row(
                "SELECT local_path FROM thumbnails WHERE file_id = ?1 AND size = 256 LIMIT 1",
                params![file.id],
                |row| row.get(0),
            )
            .ok();
        file.thumbnail_path = thumb;
    }
    Ok(())
}

pub fn search_files(conn: &Connection, query: &str) -> Result<Vec<FileEntry>, String> {
    if let Ok(files) = search_files_fts(conn, query, None, None, 200, 0) {
        if !files.is_empty() {
            return Ok(files);
        }
    }
    search_files_like(conn, query)
}

pub fn search_files_like(conn: &Connection, query: &str) -> Result<Vec<FileEntry>, String> {
    let pattern = format!("%{}%", query);
    let mut stmt = conn
        .prepare(
            r#"
            SELECT DISTINCT f.* FROM files f
            LEFT JOIN ai_generation_metadata m ON m.file_id = f.id
            LEFT JOIN file_tags ft ON ft.file_id = f.id
            LEFT JOIN tags t ON t.id = ft.tag_id
            WHERE f.is_deleted = 0 AND f.is_directory = 0 AND (
              f.display_name LIKE ?1 OR f.extension LIKE ?1 OR
              m.positive_prompt LIKE ?1 OR m.negative_prompt LIKE ?1 OR
              m.model LIKE ?1 OR t.name LIKE ?1
            )
            ORDER BY f.display_name
            LIMIT 200
            "#,
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![pattern], |row| row_to_file(row))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn search_files_fts(
    conn: &Connection,
    query: &str,
    source_app: Option<&str>,
    model_filter: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<Vec<FileEntry>, String> {
    let fts_query = query
        .split_whitespace()
        .map(|w| format!("\"{}\"", w.replace('"', "")))
        .collect::<Vec<_>>()
        .join(" ");
    if fts_query.is_empty() {
        return Ok(Vec::new());
    }

    let model_pattern = model_filter.map(|m| format!("%{m}%"));
    let limit = limit.max(1);
    let offset = offset.max(0);

    let mut files = match (source_app, model_pattern.as_deref()) {
        (Some(app), Some(mp)) => {
            let mut stmt = conn.prepare(
                r#"
                SELECT f.* FROM files f
                INNER JOIN files_fts fts ON fts.file_id = f.id
                LEFT JOIN ai_generation_metadata m ON m.file_id = f.id
                WHERE f.is_deleted = 0 AND f.is_directory = 0
                  AND fts MATCH ?1 AND m.source_app = ?2 AND m.model LIKE ?3
                ORDER BY f.display_name LIMIT ?4 OFFSET ?5
                "#,
            ).map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![fts_query, app, mp, limit, offset], |row| row_to_file(row)).map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        }
        (Some(app), None) => {
            let mut stmt = conn.prepare(
                r#"
                SELECT f.* FROM files f
                INNER JOIN files_fts fts ON fts.file_id = f.id
                LEFT JOIN ai_generation_metadata m ON m.file_id = f.id
                WHERE f.is_deleted = 0 AND f.is_directory = 0
                  AND fts MATCH ?1 AND m.source_app = ?2
                ORDER BY f.display_name LIMIT ?3 OFFSET ?4
                "#,
            ).map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![fts_query, app, limit, offset], |row| row_to_file(row)).map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        }
        (None, Some(mp)) => {
            let mut stmt = conn.prepare(
                r#"
                SELECT f.* FROM files f
                INNER JOIN files_fts fts ON fts.file_id = f.id
                LEFT JOIN ai_generation_metadata m ON m.file_id = f.id
                WHERE f.is_deleted = 0 AND f.is_directory = 0
                  AND fts MATCH ?1 AND m.model LIKE ?2
                ORDER BY f.display_name LIMIT ?3 OFFSET ?4
                "#,
            ).map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![fts_query, mp, limit, offset], |row| row_to_file(row)).map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        }
        (None, None) => {
            let mut stmt = conn.prepare(
                r#"
                SELECT f.* FROM files f
                INNER JOIN files_fts fts ON fts.file_id = f.id
                WHERE f.is_deleted = 0 AND f.is_directory = 0 AND fts MATCH ?1
                ORDER BY f.display_name LIMIT ?2 OFFSET ?3
                "#,
            ).map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![fts_query, limit, offset], |row| row_to_file(row)).map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        }
    };

    attach_db_metadata(conn, &mut files)?;
    Ok(files)
}

pub fn list_duplicate_files(conn: &Connection) -> Result<Vec<FileEntry>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT f.* FROM files f
            INNER JOIN (
              SELECT content_hash FROM files
              WHERE content_hash IS NOT NULL AND is_deleted = 0 AND is_directory = 0
              GROUP BY content_hash HAVING COUNT(*) > 1
            ) d ON d.content_hash = f.content_hash
            WHERE f.is_deleted = 0 AND f.is_directory = 0
            ORDER BY f.content_hash, f.display_name
            "#,
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row_to_file(row))
        .map_err(|e| e.to_string())?;
    let mut files: Vec<FileEntry> = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    attach_db_metadata(conn, &mut files)?;
    Ok(files)
}
