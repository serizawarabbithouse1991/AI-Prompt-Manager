use std::collections::HashSet;

use std::path::Path;

use rusqlite::{params, Connection};

use crate::db::repositories::collections::{
    add_file_to_collection, ensure_smart_collection_for_character,
    find_smart_collection_for_character, record_character_suggestions,
};
use crate::models::collection::{AssignResult, BatchAssignResult};
use crate::services::danbooru_index::{
    canonical_name_for_tag, ensure_cache_ready, filter_character_tags,
};

pub fn normalize_tag(tag: &str) -> String {
    tag.trim()
        .to_lowercase()
        .replace('_', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn strip_weight_syntax(raw: &str) -> String {
    let trimmed = raw.trim();
    if let Some(inner) = trimmed.strip_prefix('{').and_then(|s| s.strip_suffix('}')) {
        return inner.to_string();
    }
    if let Some((_, rest)) = trimmed.split_once("::") {
        if let Some((tag, _)) = rest.rsplit_once("::") {
            return tag.to_string();
        }
        return rest.to_string();
    }
    trimmed.to_string()
}

pub fn tokenize_prompt(prompt: &str) -> Vec<String> {
    let mut tags = Vec::new();
    let mut seen = HashSet::new();

    for part in prompt.split([',', '\n']) {
        let cleaned = strip_weight_syntax(part);
        let normalized = normalize_tag(&cleaned);
        if normalized.len() < 2 {
            continue;
        }
        if seen.insert(normalized.clone()) {
            tags.push(normalized);
        }
    }

    tags
}

fn assign_count_for_file(
    conn: &Connection,
    file_id: &str,
    collection_id: &str,
) -> Result<u32, String> {
    let before = conn
        .query_row(
            "SELECT COUNT(*) FROM collection_files WHERE collection_id = ?1 AND file_id = ?2",
            params![collection_id, file_id],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0);
    add_file_to_collection(conn, collection_id, file_id)?;
    let after = conn
        .query_row(
            "SELECT COUNT(*) FROM collection_files WHERE collection_id = ?1 AND file_id = ?2",
            params![collection_id, file_id],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0);
    Ok(if after > before { 1 } else { 0 })
}

fn suggest_unassigned_character_tags(
    conn: &Connection,
    char_tags: &[String],
) -> Result<Vec<String>, String> {
    let mut suggestions = Vec::new();
    for tag in char_tags {
        if find_smart_collection_for_character(conn, tag)?.is_none() {
            suggestions.push(tag.clone());
        }
    }
    Ok(suggestions)
}

pub fn assign_smart_collections_for_file(
    conn: &Connection,
    app_data: &Path,
    file_id: &str,
) -> Result<AssignResult, String> {
    let prompt: Option<String> = conn
        .query_row(
            "SELECT positive_prompt FROM ai_generation_metadata WHERE file_id = ?1 LIMIT 1",
            params![file_id],
            |row| row.get(0),
        )
        .ok();

    let Some(prompt) = prompt.filter(|p| !p.trim().is_empty()) else {
        return Ok(AssignResult::default());
    };

    if ensure_cache_ready(conn, app_data).is_err() {
        return Ok(AssignResult::default());
    }

    let tags = tokenize_prompt(&prompt);
    let char_tags = filter_character_tags(conn, &tags)?;
    if char_tags.is_empty() {
        return Ok(AssignResult::default());
    }

    let mut assigned_count = 0u32;
    let mut collection_ids = Vec::new();

    for tag in &char_tags {
        let canonical = canonical_name_for_tag(conn, tag)?;
        let collection_id =
            ensure_smart_collection_for_character(conn, tag, &canonical)?;
        assigned_count += assign_count_for_file(conn, file_id, &collection_id)?;
        collection_ids.push(collection_id);
    }

    let suggestions = suggest_unassigned_character_tags(conn, &char_tags)?;
    if !suggestions.is_empty() {
        record_character_suggestions(conn, &suggestions)?;
    }

    Ok(AssignResult {
        assigned_count,
        collection_ids,
    })
}

pub fn batch_assign_smart_collections(
    conn: &Connection,
    app_data: &Path,
) -> Result<BatchAssignResult, String> {
    if ensure_cache_ready(conn, app_data).is_err() {
        return Ok(BatchAssignResult::default());
    }

    let mut stmt = conn
        .prepare(
            r#"
            SELECT f.id, m.positive_prompt
            FROM files f
            INNER JOIN ai_generation_metadata m ON m.file_id = f.id
            WHERE f.is_deleted = 0 AND f.is_directory = 0
              AND m.positive_prompt IS NOT NULL AND m.positive_prompt != ''
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut assignments_added = 0u32;
    let mut suggestions_updated = 0u32;
    let files_processed = rows.len() as u32;

    for (file_id, prompt) in &rows {
        let tags = tokenize_prompt(prompt);
        let char_tags = filter_character_tags(conn, &tags)?;
        if char_tags.is_empty() {
            continue;
        }

        for tag in &char_tags {
            let canonical = canonical_name_for_tag(conn, tag)?;
            let collection_id =
                ensure_smart_collection_for_character(conn, tag, &canonical)?;
            assignments_added += assign_count_for_file(conn, file_id, &collection_id)?;
        }

        let suggestions = suggest_unassigned_character_tags(conn, &char_tags)?;
        if !suggestions.is_empty() {
            record_character_suggestions(conn, &suggestions)?;
            suggestions_updated += suggestions.len() as u32;
        }
    }

    Ok(BatchAssignResult {
        files_processed,
        assignments_added,
        suggestions_updated,
    })
}

pub fn dismiss_character_suggestion(conn: &Connection, tag: &str) -> Result<(), String> {
    let normalized = normalize_tag(tag);
    conn.execute(
        "DELETE FROM character_suggestions WHERE tag = ?1",
        params![normalized],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokenize_strips_weight_syntax() {
        let tags = tokenize_prompt("1girl, 1.2::hatsune miku::, masterpiece");
        assert!(tags.contains(&"hatsune miku".to_string()));
        assert!(tags.contains(&"1girl".to_string()));
    }

    #[test]
    fn normalize_tag_unifies_underscores() {
        assert_eq!(normalize_tag("hatsune_miku"), "hatsune miku");
    }
}
