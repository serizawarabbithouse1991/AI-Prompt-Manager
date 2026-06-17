use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub kind: String,
    pub created_at: Option<String>,
    pub file_count: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub match_keywords: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCollectionPayload {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSmartCollectionPayload {
    pub name: String,
    pub description: Option<String>,
    pub match_keywords: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCollectionKeywordsPayload {
    pub collection_id: String,
    pub match_keywords: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterSuggestion {
    pub tag: String,
    pub hit_count: u32,
    pub last_seen_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AssignResult {
    pub assigned_count: u32,
    pub collection_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub skip_reason: Option<String>,
    #[serde(default)]
    pub cache_ready: bool,
    #[serde(default)]
    pub character_tags_matched: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DanbooruIndexStatus {
    pub db_path: Option<String>,
    pub db_exists: bool,
    pub cache_count: u32,
    pub cache_built_at: Option<String>,
    pub cache_ready: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RebuildDanbooruCacheResult {
    pub cache_count: u32,
    pub db_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BatchAssignResult {
    pub files_processed: u32,
    pub assignments_added: u32,
    pub suggestions_updated: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub skip_reason: Option<String>,
    #[serde(default)]
    pub files_without_prompt: u32,
    #[serde(default)]
    pub files_without_character_tags: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartAssignmentDiagnosis {
    pub file_id: Option<String>,
    pub has_prompt: bool,
    pub prompt_preview: Option<String>,
    pub cache_count: u32,
    pub cache_ready: bool,
    pub tokenized_tags: Vec<String>,
    pub matched_character_tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub skip_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DanbooruCacheProgress {
    pub phase: String,
    pub count: u32,
    pub message: String,
}
