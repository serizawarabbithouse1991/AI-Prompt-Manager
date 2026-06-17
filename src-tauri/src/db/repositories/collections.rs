use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::db::connection::now_iso;
use crate::models::collection::Collection;
use crate::models::file::FileEntry;
use crate::db::repositories::files::{attach_db_metadata, row_to_file};

pub fn list_collections(conn: &Connection) -> Result<Vec<Collection>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT c.id, c.name, c.description, c.kind, c.created_at,
                   COUNT(cf.file_id) AS file_count
            FROM collections c
            LEFT JOIN collection_files cf ON cf.collection_id = c.id
            GROUP BY c.id
            ORDER BY c.name
            "#,
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Collection {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                kind: row.get(3)?,
                created_at: row.get(4)?,
                file_count: row.get::<_, i64>(5)? as u32,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn create_collection(
    conn: &Connection,
    name: &str,
    description: Option<&str>,
) -> Result<Collection, String> {
    let id = Uuid::new_v4().to_string();
    let created_at = now_iso();
    conn.execute(
        "INSERT INTO collections (id, name, description, kind, created_at) VALUES (?1,?2,?3,'manual',?4)",
        params![id, name, description, created_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(Collection {
        id,
        name: name.to_string(),
        description: description.map(|s| s.to_string()),
        kind: "manual".to_string(),
        created_at: Some(created_at),
        file_count: 0,
    })
}

pub fn delete_collection(conn: &Connection, collection_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM collection_files WHERE collection_id = ?1",
        params![collection_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM collections WHERE id = ?1", params![collection_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn add_file_to_collection(
    conn: &Connection,
    collection_id: &str,
    file_id: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT OR IGNORE INTO collection_files (collection_id, file_id, sort_order) VALUES (?1,?2,0)",
        params![collection_id, file_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn remove_file_from_collection(
    conn: &Connection,
    collection_id: &str,
    file_id: &str,
) -> Result<(), String> {
    conn.execute(
        "DELETE FROM collection_files WHERE collection_id = ?1 AND file_id = ?2",
        params![collection_id, file_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_collection_files(conn: &Connection, collection_id: &str) -> Result<Vec<FileEntry>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT f.* FROM files f
            INNER JOIN collection_files cf ON cf.file_id = f.id
            WHERE cf.collection_id = ?1 AND f.is_deleted = 0 AND f.is_directory = 0
            ORDER BY cf.sort_order, f.display_name
            "#,
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![collection_id], |row| row_to_file(row))
        .map_err(|e| e.to_string())?;
    let mut files: Vec<FileEntry> = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    attach_db_metadata(conn, &mut files)?;
    Ok(files)
}
