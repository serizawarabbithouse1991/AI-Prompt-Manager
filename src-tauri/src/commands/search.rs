use tauri::AppHandle;

use crate::db::connection::with_conn;
use crate::db::repositories::files as files_repo;
use crate::models::file::FileEntry;

#[tauri::command]
pub async fn search_files(app: AppHandle, query: String) -> Result<Vec<FileEntry>, String> {
    with_conn(&app, |conn| {
        let mut files = files_repo::search_files(conn, &query)?;
        files_repo::attach_db_metadata(conn, &mut files)?;
        Ok(files)
    })
}
