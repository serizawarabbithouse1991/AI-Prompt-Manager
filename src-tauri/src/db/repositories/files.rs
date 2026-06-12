use rusqlite::{params, Connection, Row};

use crate::db::connection::now_iso;
use crate::models::file::{detect_file_kind, detect_mime, FileEntry};
use crate::services::hash::path_to_id;

fn row_to_file(row: &Row) -> Result<FileEntry, rusqlite::Error> {
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

pub fn list_favorites(conn: &Connection) -> Result<Vec<FileEntry>, String> {
    let mut stmt = conn
        .prepare("SELECT * FROM files WHERE is_favorite = 1 AND is_deleted = 0 ORDER BY display_name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row_to_file(row))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn list_ai_library(conn: &Connection, ai_library_prefix: &str) -> Result<Vec<FileEntry>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT * FROM files WHERE absolute_path LIKE ?1 AND is_deleted = 0 AND is_directory = 0 ORDER BY display_name",
        )
        .map_err(|e| e.to_string())?;
    let pattern = format!("{}%", ai_library_prefix);
    let rows = stmt
        .query_map(params![pattern], |row| row_to_file(row))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
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
            "#,
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![pattern], |row| row_to_file(row))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
