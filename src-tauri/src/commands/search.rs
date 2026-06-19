use tauri::AppHandle;

use crate::db::connection::with_conn;
use crate::db::repositories::files as files_repo;
use crate::models::file::FileEntry;

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilters {
    pub source_app: Option<String>,
    pub model: Option<String>,
    pub tag_id: Option<String>,
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
        let filters = filters.unwrap_or(SearchFilters {
            source_app: None,
            model: None,
            tag_id: None,
            limit: Some(50),
            offset: Some(0),
        });
        let limit = filters.limit.unwrap_or(50);
        let offset = filters.offset.unwrap_or(0);
        files_repo::search_files_filtered(
            conn,
            &query,
            filters.source_app.as_deref(),
            filters.model.as_deref(),
            filters.tag_id.as_deref(),
            limit,
            offset,
        )
    })
}
