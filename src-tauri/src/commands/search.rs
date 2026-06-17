use tauri::AppHandle;

use crate::db::connection::with_conn;
use crate::db::repositories::files as files_repo;
use crate::models::file::FileEntry;

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilters {
    pub source_app: Option<String>,
    pub model: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[tauri::command]
pub async fn search_files(
    app: AppHandle,
    query: String,
    filters: Option<SearchFilters>,
) -> Result<Vec<FileEntry>, String> {
    with_conn(&app, |conn| {
        if let Some(f) = filters {
            let limit = f.limit.unwrap_or(50);
            let offset = f.offset.unwrap_or(0);
            if let Ok(files) = files_repo::search_files_fts(
                conn,
                &query,
                f.source_app.as_deref(),
                f.model.as_deref(),
                limit,
                offset,
            ) {
                if !files.is_empty() || !query.is_empty() {
                    return Ok(files);
                }
            }
        }
        let mut files = files_repo::search_files(conn, &query)?;
        files_repo::attach_db_metadata(conn, &mut files)?;
        Ok(files)
    })
}
