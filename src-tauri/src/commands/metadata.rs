use tauri::AppHandle;

use crate::db::connection::with_conn;
use crate::db::repositories::{files as files_repo, metadata as metadata_repo};
use crate::models::metadata::{AIGenerationMetadata, UpdateMetadataPayload};
use crate::services::metadata_extractor;

#[tauri::command]
pub async fn extract_metadata(app: AppHandle, path: String) -> Result<Option<AIGenerationMetadata>, String> {
    let file_id = crate::services::hash::path_to_id(&path);
    let meta = metadata_extractor::extract_from_file(&path, &file_id)?;
    if let Some(ref m) = meta {
        with_conn(&app, |conn| {
            if files_repo::file_from_path(conn, &path)?.is_none() {
                let entry = files_repo::build_entry_from_metadata(
                    std::path::Path::new(&path),
                    None,
                    None,
                )?;
                files_repo::upsert_file(conn, &entry)?;
            }
            metadata_repo::upsert_metadata(conn, m)
        })?;
    }
    Ok(meta)
}

#[tauri::command]
pub async fn get_metadata(app: AppHandle, file_id: String) -> Result<Option<AIGenerationMetadata>, String> {
    with_conn(&app, |conn| metadata_repo::get_by_file_id(conn, &file_id))
}

#[tauri::command]
pub async fn update_metadata(
    app: AppHandle,
    file_id: String,
    payload: UpdateMetadataPayload,
) -> Result<(), String> {
    with_conn(&app, |conn| metadata_repo::update_metadata(conn, &file_id, &payload))
}
