use tauri::AppHandle;

use crate::db::connection::with_conn;
use crate::db::repositories::{files as files_repo, tags as tags_repo};
use crate::models::tag::Tag;

#[tauri::command]
pub async fn list_tags(app: AppHandle) -> Result<Vec<Tag>, String> {
    with_conn(&app, |conn| tags_repo::list_tags(conn))
}

#[tauri::command]
pub async fn create_tag(
    app: AppHandle,
    name: String,
    color: Option<String>,
) -> Result<Tag, String> {
    with_conn(&app, |conn| tags_repo::create_tag(conn, &name, color.as_deref()))
}

#[tauri::command]
pub async fn add_tag_to_file(
    app: AppHandle,
    file_id: String,
    tag_id: String,
    absolute_path: Option<String>,
) -> Result<(), String> {
    with_conn(&app, |conn| {
        if let Some(path) = absolute_path {
            tags_repo::add_tag_with_upsert(conn, &file_id, &path, &tag_id)
        } else {
            tags_repo::add_tag_to_file(conn, &file_id, &tag_id)
        }
    })
}

#[tauri::command]
pub async fn remove_tag_from_file(
    app: AppHandle,
    file_id: String,
    tag_id: String,
) -> Result<(), String> {
    with_conn(&app, |conn| tags_repo::remove_tag_from_file(conn, &file_id, &tag_id))
}

#[tauri::command]
pub async fn get_file_tags(app: AppHandle, file_id: String) -> Result<Vec<Tag>, String> {
    with_conn(&app, |conn| tags_repo::get_file_tags(conn, &file_id))
}

#[tauri::command]
pub async fn set_favorite(
    app: AppHandle,
    file_id: String,
    is_favorite: bool,
    absolute_path: Option<String>,
) -> Result<(), String> {
    with_conn(&app, |conn| {
        if let Some(path) = absolute_path {
            files_repo::set_favorite_with_upsert(conn, &file_id, &path, is_favorite)
        } else {
            files_repo::set_favorite(conn, &file_id, is_favorite)
        }
    })
}
