use tauri::AppHandle;

use crate::db::connection::with_conn;
use crate::db::repositories::collections as collections_repo;
use crate::models::collection::{Collection, CreateCollectionPayload};
use crate::models::file::FileEntry;

#[tauri::command]
pub async fn list_collections(app: AppHandle) -> Result<Vec<Collection>, String> {
    with_conn(&app, collections_repo::list_collections)
}

#[tauri::command]
pub async fn create_collection(
    app: AppHandle,
    payload: CreateCollectionPayload,
) -> Result<Collection, String> {
    with_conn(&app, |conn| {
        collections_repo::create_collection(conn, &payload.name, payload.description.as_deref())
    })
}

#[tauri::command]
pub async fn delete_collection(app: AppHandle, collection_id: String) -> Result<(), String> {
    with_conn(&app, |conn| collections_repo::delete_collection(conn, &collection_id))
}

#[tauri::command]
pub async fn list_collection_files(
    app: AppHandle,
    collection_id: String,
) -> Result<Vec<FileEntry>, String> {
    with_conn(&app, |conn| collections_repo::list_collection_files(conn, &collection_id))
}

#[tauri::command]
pub async fn add_file_to_collection(
    app: AppHandle,
    collection_id: String,
    file_id: String,
) -> Result<(), String> {
    with_conn(&app, |conn| collections_repo::add_file_to_collection(conn, &collection_id, &file_id))
}

#[tauri::command]
pub async fn remove_file_from_collection(
    app: AppHandle,
    collection_id: String,
    file_id: String,
) -> Result<(), String> {
    with_conn(&app, |conn| {
        collections_repo::remove_file_from_collection(conn, &collection_id, &file_id)
    })
}
