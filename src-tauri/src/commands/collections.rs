use tauri::{AppHandle, State};

use crate::db::connection::{app_data_dir, DbState};
use crate::db::repositories::collections as collections_repo;
use crate::models::collection::{
    BatchAssignResult, CharacterSuggestion, Collection, CreateCollectionPayload,
    CreateSmartCollectionPayload, SmartAssignmentDiagnosis, UpdateCollectionKeywordsPayload,
};
use crate::models::file::FileEntry;
use crate::services::character_matcher;

#[tauri::command]
pub fn list_collections(state: State<'_, DbState>) -> Result<Vec<Collection>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    collections_repo::list_collections(&conn)
}

#[tauri::command]
pub fn create_collection(
    state: State<'_, DbState>,
    payload: CreateCollectionPayload,
) -> Result<Collection, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    collections_repo::create_collection(&conn, &payload.name, payload.description.as_deref())
}

#[tauri::command]
pub fn create_smart_collection(
    state: State<'_, DbState>,
    payload: CreateSmartCollectionPayload,
) -> Result<Collection, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    collections_repo::create_smart_collection(
        &conn,
        &payload.name,
        payload.description.as_deref(),
        &payload.match_keywords,
    )
}

#[tauri::command]
pub fn update_collection_keywords(
    state: State<'_, DbState>,
    payload: UpdateCollectionKeywordsPayload,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    collections_repo::update_collection_keywords(
        &conn,
        &payload.collection_id,
        &payload.match_keywords,
    )
}

#[tauri::command]
pub fn diagnose_smart_assignment(
    state: State<'_, DbState>,
    file_id: Option<String>,
) -> Result<SmartAssignmentDiagnosis, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    character_matcher::diagnose_smart_assignment(&conn, file_id.as_deref())
}

#[tauri::command]
pub fn batch_assign_smart_collections(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<BatchAssignResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let app_data = app_data_dir(&app)?;
    character_matcher::batch_assign_smart_collections(&conn, &app_data)
}

#[tauri::command]
pub fn list_character_suggestions(
    state: State<'_, DbState>,
    limit: Option<u32>,
) -> Result<Vec<CharacterSuggestion>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    collections_repo::list_character_suggestions(&conn, limit.unwrap_or(50))
}

#[tauri::command]
pub fn dismiss_character_suggestion(state: State<'_, DbState>, tag: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    character_matcher::dismiss_character_suggestion(&conn, &tag)
}

#[tauri::command]
pub fn delete_collection(state: State<'_, DbState>, collection_id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    collections_repo::delete_collection(&conn, &collection_id)
}

#[tauri::command]
pub fn list_collection_files(
    state: State<'_, DbState>,
    collection_id: String,
) -> Result<Vec<FileEntry>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    collections_repo::list_collection_files(&conn, &collection_id)
}

#[tauri::command]
pub fn add_file_to_collection(
    state: State<'_, DbState>,
    collection_id: String,
    file_id: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    collections_repo::add_file_to_collection(&conn, &collection_id, &file_id)
}

#[tauri::command]
pub fn remove_file_from_collection(
    state: State<'_, DbState>,
    collection_id: String,
    file_id: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    collections_repo::remove_file_from_collection(&conn, &collection_id, &file_id)
}
