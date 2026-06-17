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
}
