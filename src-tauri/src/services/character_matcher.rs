use std::collections::HashSet;
use std::path::Path;

use rusqlite::{params, Connection};

use crate::db::repositories::collections::{
    ensure_smart_collection_for_character, ensure_smart_rules_cache,
    find_smart_collection_for_character, record_character_suggestions,
};
use crate::models::collection::{AssignResult, BatchAssignResult, SmartAssignmentDiagnosis};
use crate::services::danbooru_index::{
    canonical_name_for_tag, character_cache_count, ensure_memory_index, find_characters_in_prompt,
    is_cache_ready, require_cache_ready, SKIP_CACHE_NOT_READY,
};

pub const SKIP_NO_PROMPT: &str = "no_prompt";
pub const SKIP_NO_CHARACTER_TAGS: &str = "no_character_tags";

pub fn normalize_tag(tag: &str) -> String {
    tag.trim()
        .to_lowercase()
        .replace('_', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn strip_prefixes(raw: &str) -> String {
    let lower = raw.trim().to_lowercase();
    for prefix in ["artist:", "copyright:", "character:", "meta:"] {
        if let Some(rest) = lower.strip_prefix(prefix) {
            return rest.to_string();
        }
    }
    raw.trim().to_string()
}

fn strip_brackets_and_weights(raw: &str) -> String {
    let mut s = raw.trim().to_string();
    if (s.starts_with("{{") && s.ends_with("}}")) || (s.starts_with('{') && s.ends_with('}')) {
        let start = if s.starts_with("{{") { 2 } else { 1 };
        let end = if s.ends_with("}}") { 2 } else { 1 };
        s = s[start..s.len() - end].to_string();
    }
    if (s.starts_with("[[") && s.ends_with("]]")) || (s.starts_with('[') && s.ends_with(']')) {
        let start = if s.starts_with("[[") { 2 } else { 1 };
        let end = if s.ends_with("]]") { 2 } else { 1 };
        s = s[start..s.len() - end].to_string();
    }
    if s.starts_with('(') && s.ends_with(')') {
        let inner = &s[1..s.len() - 1];
        if let Some((tag, _)) = inner.rsplit_once(':') {
            return tag.trim().to_string();
        }
    }
    s
}

fn strip_weight_syntax(raw: &str) -> String {
    let trimmed = strip_brackets_and_weights(&strip_prefixes(raw));
    if let Some((_, rest)) = trimmed.split_once("::") {
        if let Some((tag, _)) = rest.rsplit_once("::") {
            return tag.to_string();
        }
        return rest.to_string();
    }
    trimmed
}

fn split_prompt_parts(prompt: &str) -> Vec<&str> {
    let mut parts = Vec::new();
    let break_marker = " break ";
    let lower = prompt.to_lowercase();
    let mut last = 0usize;
    for (idx, _) in lower.match_indices(break_marker) {
        if idx > last {
            parts.push(&prompt[last..idx]);
        }
        last = idx + break_marker.len();
    }
    if last < prompt.len() {
        parts.push(&prompt[last..]);
    }
    if parts.is_empty() {
        parts.push(prompt);
    }
    parts
}

pub fn tokenize_prompt(prompt: &str) -> Vec<String> {
    let mut tags = Vec::new();
    let mut seen = HashSet::new();

    for segment in split_prompt_parts(prompt) {
        for part in segment.split([',', '\n', '|']) {
            let cleaned = strip_weight_syntax(part);
            let normalized = normalize_tag(&cleaned);
            if normalized.len() < 2 {
                continue;
            }
            if seen.insert(normalized.clone()) {
                tags.push(normalized);
            }
        }
    }

    tags
}

pub fn expand_tag_candidates(tags: &[String]) -> Vec<String> {
    let mut seen: HashSet<String> = tags.iter().cloned().collect();
    let mut candidates = tags.to_vec();
    for window in 2..=4 {
        if tags.len() < window {
            continue;
        }
        for i in 0..=tags.len() - window {
            let joined = tags[i..i + window].join(" ");
            if seen.insert(joined.clone()) {
                candidates.push(joined);
            }
        }
    }
    candidates
}

fn assign_count_for_file(
    conn: &Connection,
    file_id: &str,
    collection_id: &str,
) -> Result<u32, String> {
    let changes = conn
        .execute(
            "INSERT OR IGNORE INTO collection_files (collection_id, file_id, sort_order) VALUES (?1,?2,0)",
            params![collection_id, file_id],
        )
        .map_err(|e| e.to_string())?;
    Ok(if changes > 0 { 1 } else { 0 })
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

fn prompt_preview(prompt: &str) -> String {
    if prompt.len() > 120 {
        format!("{}…", &prompt[..120])
    } else {
        prompt.to_string()
    }
}

pub fn diagnose_smart_assignment(
    conn: &Connection,
    file_id: Option<&str>,
) -> Result<SmartAssignmentDiagnosis, String> {
    let cache_count = character_cache_count(conn)?;
    let cache_ready = cache_count > 0;

    let resolved_file_id = if let Some(id) = file_id {
        id.to_string()
    } else {
        conn.query_row(
            r#"
            SELECT f.id FROM files f
            INNER JOIN ai_generation_metadata m ON m.file_id = f.id
            WHERE f.is_deleted = 0 AND m.positive_prompt IS NOT NULL AND m.positive_prompt != ''
            ORDER BY f.indexed_at DESC
            LIMIT 1
            "#,
            [],
            |row| row.get::<_, String>(0),
        )
        .map_err(|_| "診断対象の画像が見つかりません".to_string())?
    };

    let prompt: Option<String> = conn
        .query_row(
            "SELECT positive_prompt FROM ai_generation_metadata WHERE file_id = ?1 LIMIT 1",
            params![resolved_file_id],
            |row| row.get(0),
        )
        .ok();

    let Some(prompt) = prompt.filter(|p| !p.trim().is_empty()) else {
        return Ok(SmartAssignmentDiagnosis {
            file_id: Some(resolved_file_id),
            has_prompt: false,
            prompt_preview: None,
            cache_count,
            cache_ready,
            tokenized_tags: Vec::new(),
            matched_character_tags: Vec::new(),
            skip_reason: Some(SKIP_NO_PROMPT.to_string()),
        });
    };

    if !cache_ready {
        return Ok(SmartAssignmentDiagnosis {
            file_id: Some(resolved_file_id),
            has_prompt: true,
            prompt_preview: Some(prompt_preview(&prompt)),
            cache_count,
            cache_ready: false,
            tokenized_tags: tokenize_prompt(&prompt),
            matched_character_tags: Vec::new(),
            skip_reason: Some(SKIP_CACHE_NOT_READY.to_string()),
        });
    }

    let tags = tokenize_prompt(&prompt);
    ensure_memory_index(conn)?;
    ensure_smart_rules_cache(conn)?;
    let char_tags = find_characters_in_prompt(conn, &prompt, &tags)?;
    let skip_reason = if char_tags.is_empty() {
        Some(SKIP_NO_CHARACTER_TAGS.to_string())
    } else {
        None
    };

    Ok(SmartAssignmentDiagnosis {
        file_id: Some(resolved_file_id),
        has_prompt: true,
        prompt_preview: Some(prompt_preview(&prompt)),
        cache_count,
        cache_ready,
        tokenized_tags: tags,
        matched_character_tags: char_tags,
        skip_reason,
    })
}

pub fn assign_smart_collections_for_file(
    conn: &Connection,
    _app_data: &Path,
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
        return Ok(AssignResult {
            skip_reason: Some(SKIP_NO_PROMPT.to_string()),
            ..AssignResult::default()
        });
    };

    let cache_count = match require_cache_ready(conn) {
        Ok(count) => count,
        Err(_) => {
            return Ok(AssignResult {
                skip_reason: Some(SKIP_CACHE_NOT_READY.to_string()),
                cache_ready: false,
                ..AssignResult::default()
            });
        }
    };

    let tags = tokenize_prompt(&prompt);
    ensure_memory_index(conn)?;
    ensure_smart_rules_cache(conn)?;
    let char_tags = find_characters_in_prompt(conn, &prompt, &tags)?;
    if char_tags.is_empty() {
        return Ok(AssignResult {
            skip_reason: Some(SKIP_NO_CHARACTER_TAGS.to_string()),
            cache_ready: true,
            ..AssignResult::default()
        });
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
        cache_ready: cache_count > 0,
        character_tags_matched: char_tags.len() as u32,
        skip_reason: None,
    })
}

pub fn batch_assign_smart_collections(
    conn: &Connection,
    _app_data: &Path,
) -> Result<BatchAssignResult, String> {
    if !is_cache_ready(conn)? {
        return Ok(BatchAssignResult {
            skip_reason: Some(SKIP_CACHE_NOT_READY.to_string()),
            ..BatchAssignResult::default()
        });
    }

    ensure_memory_index(conn)?;
    ensure_smart_rules_cache(conn)?;

    let total_files: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM files WHERE is_deleted = 0 AND is_directory = 0",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| e.to_string())? as u32;

    let files_without_prompt: u32 = conn
        .query_row(
            r#"
            SELECT COUNT(*) FROM files f
            LEFT JOIN ai_generation_metadata m ON m.file_id = f.id
            WHERE f.is_deleted = 0 AND f.is_directory = 0
              AND (m.positive_prompt IS NULL OR m.positive_prompt = '')
            "#,
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| e.to_string())? as u32;

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
    let mut files_without_character_tags = 0u32;

    for (file_id, prompt) in &rows {
        let tags = tokenize_prompt(prompt);
        let char_tags = find_characters_in_prompt(conn, prompt, &tags)?;
        if char_tags.is_empty() {
            files_without_character_tags += 1;
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
        files_processed: total_files,
        assignments_added,
        suggestions_updated,
        files_without_prompt,
        files_without_character_tags,
        skip_reason: None,
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
    fn tokenize_handles_brackets_and_break() {
        let tags = tokenize_prompt("{{hatsune miku}}, 1girl | BREAK | solo");
        assert!(tags.contains(&"hatsune miku".to_string()));
        assert!(tags.contains(&"solo".to_string()));
    }

    #[test]
    fn normalize_tag_unifies_underscores() {
        assert_eq!(normalize_tag("hatsune_miku"), "hatsune miku");
    }

    #[test]
    fn expand_tag_candidates_builds_bigrams() {
        let tags = vec!["hatsune".to_string(), "miku".to_string(), "solo".to_string()];
        let expanded = expand_tag_candidates(&tags);
        assert!(expanded.contains(&"hatsune miku".to_string()));
    }
}
