use chrono::{Duration, Utc};
use rusqlite::{params, Connection};

use crate::db::connection::now_iso;

pub fn incremental_fetch_since(conn: &Connection) -> Result<Option<String>, String> {
    let latest: Option<String> = conn
        .query_row(
            "SELECT MAX(processed_at) FROM processed_photo_assets",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let Some(latest) = latest else {
        return Ok(None);
    };
    let parsed = chrono::DateTime::parse_from_rfc3339(&latest)
        .map(|dt| dt.with_timezone(&Utc))
        .ok()
        .or_else(|| {
            chrono::NaiveDateTime::parse_from_str(&latest, "%Y-%m-%dT%H:%M:%S%.fZ")
                .ok()
                .map(|dt| dt.and_utc())
        })
        .or_else(|| {
            chrono::NaiveDateTime::parse_from_str(&latest, "%Y-%m-%d %H:%M:%S")
                .ok()
                .map(|dt| dt.and_utc())
        });
    Ok(Some(
        parsed
            .map(|dt| (dt - Duration::hours(24)).to_rfc3339())
            .unwrap_or(latest),
    ))
}

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
