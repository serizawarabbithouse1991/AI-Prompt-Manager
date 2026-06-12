use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIGenerationMetadata {
    pub id: String,
    pub file_id: String,
    pub source_app: Option<String>,
    pub positive_prompt: Option<String>,
    pub negative_prompt: Option<String>,
    pub model: Option<String>,
    pub sampler: Option<String>,
    pub scheduler: Option<String>,
    pub seed: Option<String>,
    pub steps: Option<i64>,
    pub cfg_scale: Option<f64>,
    pub generation_width: Option<i64>,
    pub generation_height: Option<i64>,
    pub workflow_json: Option<String>,
    pub raw_metadata_json: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetadataPayload {
    pub positive_prompt: Option<String>,
    pub negative_prompt: Option<String>,
    pub model: Option<String>,
}
