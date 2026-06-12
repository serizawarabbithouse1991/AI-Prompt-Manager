use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::db::connection::now_iso;

pub fn save_thumbnail(
    conn: &Connection,
    file_id: &str,
    size: u32,
    local_path: &str,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "DELETE FROM thumbnails WHERE file_id = ?1 AND size = ?2",
        params![file_id, size as i64],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO thumbnails (id, file_id, size, local_path, created_at) VALUES (?1,?2,?3,?4,?5)",
        params![id, file_id, size as i64, local_path, now_iso()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_thumbnail_path(
    conn: &Connection,
    file_id: &str,
    size: u32,
) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT local_path FROM thumbnails WHERE file_id = ?1 AND size = ?2 LIMIT 1",
        params![file_id, size as i64],
        |row| row.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}
