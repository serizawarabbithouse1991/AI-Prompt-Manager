use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagApplyResult {
    pub tags_added: u32,
    pub tags_skipped: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skip_reason: Option<String>,
}

impl Default for TagApplyResult {
    fn default() -> Self {
        Self {
            tags_added: 0,
            tags_skipped: 0,
            skip_reason: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchTagApplyResult {
    pub files_processed: u32,
    pub tags_added: u32,
    pub tags_skipped: u32,
    pub files_without_prompt: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skip_reason: Option<String>,
}

impl Default for BatchTagApplyResult {
    fn default() -> Self {
        Self {
            files_processed: 0,
            tags_added: 0,
            tags_skipped: 0,
            files_without_prompt: 0,
            skip_reason: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptTagSettings {
    pub mode: String,
    pub auto_tag_on_import: bool,
}
