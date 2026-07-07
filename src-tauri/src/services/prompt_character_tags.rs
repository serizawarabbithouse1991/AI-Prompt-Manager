use std::collections::HashSet;

use rusqlite::Connection;

use crate::db::repositories::collections::{ensure_smart_rules_cache, list_smart_collection_rules};
use crate::services::character_matcher::{
    expand_tag_candidates, is_quality_tag, normalize_tag, strip_weight_syntax,
};

pub fn find_characters_in_prompt(
    conn: &Connection,
    prompt: &str,
    tags: &[String],
) -> Result<Vec<String>, String> {
    let mut matched = HashSet::new();

    for segment in prompt.split([',', '\n', '|']) {
        let trimmed = segment.trim();
        if trimmed.is_empty() {
            continue;
        }
        let lower = trimmed.to_lowercase();
        if lower.starts_with("character:") {
            let cleaned = strip_weight_syntax(trimmed);
            let normalized = normalize_tag(&cleaned);
            if is_usable_character_tag(&normalized) {
                matched.insert(normalized);
            }
        }
    }

    ensure_smart_rules_cache(conn)?;
    let rules = list_smart_collection_rules(conn)?;
    let candidates = expand_tag_candidates(tags);
    let norm_prompt = normalize_tag(prompt);

    for rule in rules {
        for keyword in &rule.match_keywords {
            let normalized = normalize_tag(keyword);
            if !is_usable_character_tag(&normalized) {
                continue;
            }
            if candidates.iter().any(|c| c == &normalized)
                || tags.iter().any(|t| t == &normalized)
                || norm_prompt.contains(&normalized)
            {
                matched.insert(normalized);
            }
        }
    }

    let mut result: Vec<String> = matched.into_iter().collect();
    result.sort();
    Ok(result)
}

pub fn canonical_name_for_tag(_conn: &Connection, normalized: &str) -> Result<String, String> {
    Ok(normalized.replace(' ', "_"))
}

fn is_usable_character_tag(normalized: &str) -> bool {
    if normalized.chars().count() < 2 {
        return false;
    }
    if is_quality_tag(normalized) {
        return false;
    }
    !matches!(
        normalized,
        "1girl"
            | "1boy"
            | "2girls"
            | "2boys"
            | "3girls"
            | "3boys"
            | "solo"
            | "multiple girls"
            | "multiple boys"
            | "girl"
            | "boy"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::character_matcher::tokenize_prompt;
    use rusqlite::Connection;

    fn setup(conn: &Connection) {
        conn.execute_batch(
            r#"
            CREATE TABLE collections (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT,
              kind TEXT DEFAULT 'manual',
              created_at TEXT,
              match_keywords TEXT
            );
            INSERT INTO collections (id, name, kind, created_at, match_keywords)
            VALUES ('c1', 'Miku', 'smart_character', 'now', '["hatsune miku"]');
            "#,
        )
        .unwrap();
    }

    #[test]
    fn finds_character_prefixed_tags() {
        let conn = Connection::open_in_memory().unwrap();
        setup(&conn);
        let tags = tokenize_prompt("character:hatsune miku, 1girl, masterpiece");
        let matched = find_characters_in_prompt(
            &conn,
            "character:hatsune miku, 1girl, masterpiece",
            &tags,
        )
        .unwrap();
        assert!(matched.contains(&"hatsune miku".to_string()));
    }

    #[test]
    fn matches_existing_smart_collection_keywords() {
        let conn = Connection::open_in_memory().unwrap();
        setup(&conn);
        let tags = tokenize_prompt("1girl, hatsune miku, masterpiece");
        let matched =
            find_characters_in_prompt(&conn, "1girl, hatsune miku, masterpiece", &tags).unwrap();
        assert!(matched.contains(&"hatsune miku".to_string()));
    }
}
