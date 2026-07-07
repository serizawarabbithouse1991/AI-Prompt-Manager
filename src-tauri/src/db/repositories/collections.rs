use rusqlite::{params, Connection};
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

use crate::db::connection::now_iso;
use crate::models::collection::{CharacterSuggestion, Collection};
use crate::models::file::FileEntry;
use crate::db::repositories::files::{attach_db_metadata, row_to_file};
use crate::services::character_matcher::normalize_tag;

#[derive(Debug, Clone)]
pub struct SmartCollectionRule {
    pub id: String,
    pub match_keywords: Vec<String>,
}

static SMART_RULES_CACHE: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

pub fn invalidate_smart_rules_cache() {
    if let Ok(mut guard) = SMART_RULES_CACHE.lock() {
        *guard = None;
    }
}

fn load_smart_rules_cache(conn: &Connection) -> Result<HashMap<String, String>, String> {
    let rules = list_smart_collection_rules(conn)?;
    let mut map = HashMap::new();
    for rule in rules {
        for keyword in &rule.match_keywords {
            map.insert(normalize_tag(keyword), rule.id.clone());
        }
    }
    Ok(map)
}

pub fn ensure_smart_rules_cache(conn: &Connection) -> Result<(), String> {
    let needs_load = SMART_RULES_CACHE
        .lock()
        .map_err(|e| e.to_string())?
        .is_none();
    if needs_load {
        let map = load_smart_rules_cache(conn)?;
        let mut guard = SMART_RULES_CACHE.lock().map_err(|e| e.to_string())?;
        *guard = Some(map);
    }
    Ok(())
}

fn register_smart_rule_in_cache(keywords: &[String], collection_id: &str) -> Result<(), String> {
    let mut guard = SMART_RULES_CACHE.lock().map_err(|e| e.to_string())?;
    if let Some(cache) = guard.as_mut() {
        for keyword in keywords {
            cache.insert(normalize_tag(keyword), collection_id.to_string());
        }
    }
    Ok(())
}

fn parse_match_keywords(raw: Option<String>) -> Option<Vec<String>> {
    let raw = raw?;
    if raw.trim().is_empty() {
        return None;
    }
    serde_json::from_str::<Vec<String>>(&raw).ok()
}

fn row_to_collection(row: &rusqlite::Row<'_>) -> rusqlite::Result<Collection> {
    Ok(Collection {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        kind: row.get(3)?,
        created_at: row.get(4)?,
        file_count: row.get::<_, i64>(5)? as u32,
        match_keywords: parse_match_keywords(row.get(6).ok()),
    })
}

pub fn list_collections(conn: &Connection) -> Result<Vec<Collection>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT c.id, c.name, c.description, c.kind, c.created_at,
                   COUNT(cf.file_id) AS file_count,
                   c.match_keywords
            FROM collections c
            LEFT JOIN collection_files cf ON cf.collection_id = c.id
            GROUP BY c.id
            ORDER BY c.name
            "#,
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], row_to_collection)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn list_smart_collection_rules(conn: &Connection) -> Result<Vec<SmartCollectionRule>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, match_keywords FROM collections WHERE kind = 'smart_character' AND match_keywords IS NOT NULL",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let raw: Option<String> = row.get(1)?;
            let match_keywords = parse_match_keywords(raw).unwrap_or_default();
            Ok(SmartCollectionRule { id, match_keywords })
        })
        .map_err(|e| e.to_string())?;
    let mut rules = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    rules.retain(|r| !r.match_keywords.is_empty());
    Ok(rules)
}

pub fn create_collection(
    conn: &Connection,
    name: &str,
    description: Option<&str>,
) -> Result<Collection, String> {
    let id = Uuid::new_v4().to_string();
    let created_at = now_iso();
    conn.execute(
        "INSERT INTO collections (id, name, description, kind, created_at, match_keywords) VALUES (?1,?2,?3,'manual',?4,NULL)",
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
        match_keywords: None,
    })
}

pub fn create_smart_collection(
    conn: &Connection,
    name: &str,
    description: Option<&str>,
    match_keywords: &[String],
) -> Result<Collection, String> {
    let normalized: Vec<String> = match_keywords
        .iter()
        .map(|k| k.trim().to_string())
        .filter(|k| !k.is_empty())
        .collect();
    if normalized.is_empty() {
        return Err("マッチキーワードが必要です".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let created_at = now_iso();
    let keywords_json = serde_json::to_string(&normalized).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO collections (id, name, description, kind, created_at, match_keywords) VALUES (?1,?2,?3,'smart_character',?4,?5)",
        params![id, name, description, created_at, keywords_json],
    )
    .map_err(|e| e.to_string())?;
    register_smart_rule_in_cache(&normalized, &id)?;
    Ok(Collection {
        id,
        name: name.to_string(),
        description: description.map(|s| s.to_string()),
        kind: "smart_character".to_string(),
        created_at: Some(created_at),
        file_count: 0,
        match_keywords: Some(normalized),
    })
}

pub fn update_collection_keywords(
    conn: &Connection,
    collection_id: &str,
    match_keywords: &[String],
) -> Result<(), String> {
    let normalized: Vec<String> = match_keywords
        .iter()
        .map(|k| k.trim().to_string())
        .filter(|k| !k.is_empty())
        .collect();
    if normalized.is_empty() {
        return Err("マッチキーワードが必要です".to_string());
    }
    let keywords_json = serde_json::to_string(&normalized).map_err(|e| e.to_string())?;
    let updated = conn
        .execute(
            "UPDATE collections SET match_keywords = ?1, kind = 'smart_character' WHERE id = ?2",
            params![keywords_json, collection_id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("コレクションが見つかりません".to_string());
    }
    invalidate_smart_rules_cache();
    Ok(())
}

pub fn delete_collection(conn: &Connection, collection_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM collection_files WHERE collection_id = ?1",
        params![collection_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM collections WHERE id = ?1", params![collection_id])
        .map_err(|e| e.to_string())?;
    invalidate_smart_rules_cache();
    Ok(())
}

pub fn batch_add_files_to_collection(
    conn: &Connection,
    collection_id: &str,
    file_ids: &[String],
) -> Result<u32, String> {
    let mut added = 0u32;
    for file_id in file_ids {
        let changes = conn
            .execute(
                "INSERT OR IGNORE INTO collection_files (collection_id, file_id, sort_order) VALUES (?1,?2,0)",
                params![collection_id, file_id],
            )
            .map_err(|e| e.to_string())?;
        added += changes as u32;
    }
    Ok(added)
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

pub fn find_smart_collection_for_character(
    conn: &Connection,
    normalized_tag: &str,
) -> Result<Option<String>, String> {
    ensure_smart_rules_cache(conn)?;
    let guard = SMART_RULES_CACHE.lock().map_err(|e| e.to_string())?;
    Ok(guard
        .as_ref()
        .and_then(|cache| cache.get(normalized_tag).cloned()))
}

pub fn ensure_smart_collection_for_character(
    conn: &Connection,
    normalized_tag: &str,
    canonical_name: &str,
) -> Result<String, String> {
    if let Some(id) = find_smart_collection_for_character(conn, normalized_tag)? {
        return Ok(id);
    }

    let underscore = normalized_tag.replace(' ', "_");
    let mut keywords = vec![normalized_tag.to_string(), underscore];
    let canonical_normalized = normalize_tag(canonical_name);
    if canonical_normalized != normalized_tag && !keywords.contains(&canonical_normalized) {
        keywords.push(canonical_normalized);
    }
    if canonical_name.contains('_') && !keywords.iter().any(|k| k == canonical_name) {
        keywords.push(canonical_name.to_string());
    }

    let display_name = normalized_tag.to_string();
    let collection = create_smart_collection(conn, &display_name, None, &keywords)?;
    Ok(collection.id)
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

pub fn record_character_suggestions(conn: &Connection, tags: &[String]) -> Result<(), String> {
    let now = now_iso();
    for tag in tags {
        let normalized = tag
            .trim()
            .to_lowercase()
            .replace('_', " ")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        conn.execute(
            r#"
            INSERT INTO character_suggestions (tag, hit_count, last_seen_at)
            VALUES (?1, 1, ?2)
            ON CONFLICT(tag) DO UPDATE SET
              hit_count = hit_count + 1,
              last_seen_at = excluded.last_seen_at
            "#,
            params![normalized, now],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn list_character_suggestions(conn: &Connection, limit: u32) -> Result<Vec<CharacterSuggestion>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT tag, hit_count, last_seen_at FROM character_suggestions ORDER BY hit_count DESC, tag LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(CharacterSuggestion {
                tag: row.get(0)?,
                hit_count: row.get::<_, i64>(1)? as u32,
                last_seen_at: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
