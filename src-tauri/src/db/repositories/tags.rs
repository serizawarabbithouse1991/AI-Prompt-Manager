use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::connection::now_iso;
use crate::db::repositories::files as files_repo;
use crate::models::tag::Tag;

fn row_to_tag(row: &Row) -> Result<Tag, rusqlite::Error> {
    Ok(Tag {
        id: row.get("id")?,
        name: row.get("name")?,
        color: row.get("color")?,
        kind: row.get("kind")?,
        created_at: row.get("created_at")?,
    })
}

pub fn list_tags(conn: &Connection) -> Result<Vec<Tag>, String> {
    let mut stmt = conn
        .prepare("SELECT * FROM tags ORDER BY name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row_to_tag(row))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn find_tag_by_name(conn: &Connection, name: &str) -> Result<Option<Tag>, String> {
    let mut stmt = conn
        .prepare("SELECT * FROM tags WHERE name = ?1 LIMIT 1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(params![name])
        .map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        return Ok(Some(row_to_tag(&row).map_err(|e| e.to_string())?));
    }
    Ok(None)
}

pub fn get_or_create_tag(conn: &Connection, name: &str, kind: &str) -> Result<Tag, String> {
    if let Some(tag) = find_tag_by_name(conn, name)? {
        return Ok(tag);
    }
    let tag = Tag {
        id: Uuid::new_v4().to_string(),
        name: name.to_string(),
        color: None,
        kind: kind.to_string(),
        created_at: Some(now_iso()),
    };
    conn.execute(
        "INSERT INTO tags (id, name, color, kind, created_at) VALUES (?1,?2,?3,?4,?5)",
        params![tag.id, tag.name, tag.color, tag.kind, tag.created_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(tag)
}

pub fn add_auto_tags_to_file(
    conn: &Connection,
    file_id: &str,
    absolute_path: &str,
    tag_names: &[String],
) -> Result<(u32, u32), String> {
    if tag_names.is_empty() {
        return Ok((0, 0));
    }
    if files_repo::get_by_id(conn, file_id)?.is_none() {
        files_repo::ensure_file_by_path(conn, absolute_path)?;
    }

    let existing: std::collections::HashSet<String> = get_file_tags(conn, file_id)?
        .into_iter()
        .map(|t| t.name)
        .collect();

    let mut added = 0u32;
    let mut skipped = 0u32;
    for name in tag_names {
        if existing.contains(name) {
            skipped += 1;
            continue;
        }
        let tag = get_or_create_tag(conn, name, "auto")?;
        add_tag_to_file(conn, file_id, &tag.id)?;
        added += 1;
    }
    Ok((added, skipped))
}

pub fn create_tag(conn: &Connection, name: &str, color: Option<&str>) -> Result<Tag, String> {
    let tag = Tag {
        id: Uuid::new_v4().to_string(),
        name: name.to_string(),
        color: color.map(|s| s.to_string()),
        kind: "user".to_string(),
        created_at: Some(now_iso()),
    };
    conn.execute(
        "INSERT INTO tags (id, name, color, kind, created_at) VALUES (?1,?2,?3,?4,?5)",
        params![tag.id, tag.name, tag.color, tag.kind, tag.created_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(tag)
}

pub fn add_tag_to_file(conn: &Connection, file_id: &str, tag_id: &str) -> Result<(), String> {
    conn.execute(
        "INSERT OR IGNORE INTO file_tags (file_id, tag_id) VALUES (?1, ?2)",
        params![file_id, tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn add_tag_with_upsert(
    conn: &Connection,
    file_id: &str,
    absolute_path: &str,
    tag_id: &str,
) -> Result<(), String> {
    if files_repo::get_by_id(conn, file_id)?.is_none() {
        files_repo::ensure_file_by_path(conn, absolute_path)?;
    }
    add_tag_to_file(conn, file_id, tag_id)
}

pub fn remove_tag_from_file(conn: &Connection, file_id: &str, tag_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM file_tags WHERE file_id = ?1 AND tag_id = ?2",
        params![file_id, tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_file_tags(conn: &Connection, file_id: &str) -> Result<Vec<Tag>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT t.* FROM tags t INNER JOIN file_tags ft ON ft.tag_id = t.id WHERE ft.file_id = ?1 ORDER BY t.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![file_id], |row| row_to_tag(row))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn attach_tag_ids(conn: &Connection, files: &mut [crate::models::file::FileEntry]) -> Result<(), String> {
    for file in files.iter_mut() {
        file.tag_ids = files_repo::get_file_tag_ids(conn, &file.id)?;
    }
    Ok(())
}
