use rusqlite::{params, Connection};

use crate::db::connection::now_iso;

pub fn list_processed_asset_ids(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT local_identifier FROM processed_photo_assets")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn mark_processed(conn: &Connection, local_identifier: &str) -> Result<(), String> {
    conn.execute(
        "INSERT OR IGNORE INTO processed_photo_assets (local_identifier, processed_at) VALUES (?1, ?2)",
        params![local_identifier, now_iso()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn mark_processed_batch(conn: &Connection, local_identifiers: &[String]) -> Result<(), String> {
    let now = now_iso();
    for id in local_identifiers {
        conn.execute(
            "INSERT OR IGNORE INTO processed_photo_assets (local_identifier, processed_at) VALUES (?1, ?2)",
            params![id, now],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}
