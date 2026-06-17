use tauri::AppHandle;

use crate::db::connection::with_conn;
use crate::models::prompt_tag::{BatchTagApplyResult, PromptTagSettings, TagApplyResult};
use crate::services::prompt_tagger::{self, PromptTagMode};

#[tauri::command]
pub async fn get_prompt_tag_settings(app: AppHandle) -> Result<PromptTagSettings, String> {
    with_conn(&app, prompt_tagger::get_prompt_tag_settings)
}

#[tauri::command]
pub async fn set_prompt_tag_settings(
    app: AppHandle,
    mode: String,
    auto_tag_on_import: bool,
) -> Result<(), String> {
    with_conn(&app, |conn| {
        prompt_tagger::set_prompt_tag_settings(conn, &mode, auto_tag_on_import)
    })
}

#[tauri::command]
pub async fn apply_prompt_tags_for_file(
    app: AppHandle,
    file_id: String,
    absolute_path: String,
    mode: Option<String>,
) -> Result<TagApplyResult, String> {
    with_conn(&app, |conn| {
        let tag_mode = resolve_mode(conn, mode)?;
        prompt_tagger::apply_prompt_tags_for_file(conn, &file_id, &absolute_path, tag_mode)
    })
}

#[tauri::command]
pub async fn batch_apply_prompt_tags(
    app: AppHandle,
    mode: Option<String>,
    file_ids: Option<Vec<String>>,
) -> Result<BatchTagApplyResult, String> {
    with_conn(&app, |conn| {
        let tag_mode = resolve_mode(conn, mode)?;
        let ids = file_ids.as_deref();
        prompt_tagger::batch_apply_prompt_tags(conn, tag_mode, ids)
    })
}

fn resolve_mode(conn: &rusqlite::Connection, mode: Option<String>) -> Result<PromptTagMode, String> {
    let value = mode.unwrap_or_else(|| {
        prompt_tagger::get_prompt_tag_settings(conn)
            .map(|s| s.mode)
            .unwrap_or_else(|_| "all".to_string())
    });
    Ok(PromptTagMode::from_setting(&value))
}
