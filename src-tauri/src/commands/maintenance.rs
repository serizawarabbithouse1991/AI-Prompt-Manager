use tauri::AppHandle;

use crate::db::connection::{app_data_dir, with_conn};
use crate::db::repositories::files as files_repo;
use crate::models::file::FileEntry;
use crate::services::library_reconcile::{self, BackfillResult};

#[tauri::command]
pub async fn list_duplicate_files(app: AppHandle) -> Result<Vec<FileEntry>, String> {
    with_conn(&app, files_repo::list_duplicate_files)
}

#[tauri::command]
pub async fn backfill_content_hashes(app: AppHandle) -> Result<BackfillResult, String> {
    let app_data = app_data_dir(&app)?;
    with_conn(&app, |conn| library_reconcile::backfill_content_hashes(conn, &app_data))
}

#[tauri::command]
pub async fn backup_database(app: AppHandle) -> Result<String, String> {
    let app_data = app_data_dir(&app)?;
    library_reconcile::backup_database(&app_data)
}
