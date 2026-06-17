use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub id: String,
    pub parent_id: Option<String>,
    pub absolute_path: String,
    pub display_name: String,
    pub extension: Option<String>,
    pub mime_type: Option<String>,
    pub file_kind: String,
    pub size_bytes: i64,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub created_at: Option<String>,
    pub modified_at: Option<String>,
    pub indexed_at: Option<String>,
    pub content_hash: Option<String>,
    pub is_directory: bool,
    pub is_hidden: bool,
    pub is_favorite: bool,
    pub is_deleted: bool,
    pub thumbnail_path: Option<String>,
    #[serde(default)]
    pub tag_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ai_model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ai_steps: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prompt_preview: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecialPaths {
    pub home: String,
    pub desktop: String,
    pub downloads: String,
    pub pictures: String,
    pub ai_library: String,
    pub novel_ai: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub scanned_count: u32,
    pub image_count: u32,
    pub error_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported_count: u32,
    pub image_count: u32,
    pub zip_count: u32,
    pub error_count: u32,
    #[serde(default)]
    pub skipped_count: u32,
    #[serde(default)]
    pub novelai_count: u32,
    #[serde(default)]
    pub duplicate_count: u32,
    #[serde(default)]
    pub assigned_collection_count: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assign_skip_reason: Option<String>,
    #[serde(default)]
    pub tags_added_count: u32,
}

pub fn detect_file_kind(extension: &str, is_directory: bool) -> String {
    if is_directory {
        return "directory".to_string();
    }
    match extension.to_lowercase().as_str() {
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" => "image".to_string(),
        "mp4" | "mov" | "avi" | "mkv" => "video".to_string(),
        "mp3" | "wav" | "flac" => "audio".to_string(),
        "txt" | "md" | "json" => "text".to_string(),
        "pdf" => "pdf".to_string(),
        "zip" | "rar" | "7z" => "archive".to_string(),
        _ => "unknown".to_string(),
    }
}

pub fn detect_mime(extension: &str) -> Option<String> {
    match extension.to_lowercase().as_str() {
        "png" => Some("image/png".to_string()),
        "jpg" | "jpeg" => Some("image/jpeg".to_string()),
        "webp" => Some("image/webp".to_string()),
        "gif" => Some("image/gif".to_string()),
        _ => None,
    }
}
