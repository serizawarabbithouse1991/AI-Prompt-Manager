use tauri::AppHandle;

use crate::db::connection::{app_data_dir, with_conn};
use crate::db::repositories::files as files_repo;
use crate::services::thumbnailer;

#[tauri::command]
pub async fn generate_thumbnail(
    app: AppHandle,
    path: String,
    size: u32,
) -> Result<String, String> {
    let app_data = app_data_dir(&app)?;
    with_conn(&app, |conn| thumbnailer::generate_thumbnail(conn, &app_data, &path, size))
}

#[tauri::command]
pub async fn get_thumbnail(
    app: AppHandle,
    file_id: String,
    size: u32,
) -> Result<Option<String>, String> {
    let app_data = app_data_dir(&app)?;
    with_conn(&app, |conn| {
        let file = files_repo::get_by_id(conn, &file_id)?
            .ok_or_else(|| "File not found".to_string())?;
        thumbnailer::get_thumbnail_path(conn, &app_data, &file.absolute_path, &file_id, size)
    })
}
