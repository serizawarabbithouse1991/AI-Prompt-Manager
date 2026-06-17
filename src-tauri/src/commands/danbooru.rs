use std::path::PathBuf;

use tauri::{AppHandle, Emitter, State};

use crate::db::connection::{app_data_dir, DbState};
use crate::models::collection::{
    DanbooruCacheProgress, DanbooruIndexStatus, RebuildDanbooruCacheResult,
};
use crate::services::danbooru_index::{
    self, character_cache_count, get_setting, import_danbooru_db, rebuild_character_cache,
    resolve_danbooru_db_path, SETTING_CACHE_BUILT_AT,
};

#[tauri::command]
pub fn get_danbooru_index_status(app: AppHandle, state: State<'_, DbState>) -> Result<DanbooruIndexStatus, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let app_data = app_data_dir(&app)?;
    let db_path = resolve_danbooru_db_path(&conn, &app_data).ok();
    let cache_count = character_cache_count(&conn)?;
    let cache_built_at = get_setting(&conn, SETTING_CACHE_BUILT_AT)?;
    Ok(DanbooruIndexStatus {
        db_exists: db_path.is_some(),
        db_path: db_path.map(|p| p.to_string_lossy().to_string()),
        cache_count,
        cache_built_at,
        cache_ready: cache_count > 0,
    })
}

#[tauri::command]
pub fn set_danbooru_db_path(
    state: State<'_, DbState>,
    path: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    danbooru_index::set_danbooru_db_path(&conn, &path)
}

#[tauri::command]
pub fn rebuild_danbooru_character_cache(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<RebuildDanbooruCacheResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let app_data = app_data_dir(&app)?;
    let db_path = resolve_danbooru_db_path(&conn, &app_data)?;
    let app_handle = app.clone();
    let cache_count = rebuild_character_cache(&conn, &db_path, Some(|phase: String, count| {
        let message = match phase.as_str() {
            "opening" => "Danbooru DB を開いています…".to_string(),
            "importing" => format!("{count} 件読込中…"),
            "done" => format!("{count} 件のキャラタグを読み込みました"),
            _ => format!("{phase}: {count}"),
        };
        let _ = app_handle.emit(
            "danbooru-cache-progress",
            DanbooruCacheProgress {
                phase: phase.clone(),
                count,
                message,
            },
        );
    }))?;
    Ok(RebuildDanbooruCacheResult {
        cache_count,
        db_path: db_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn import_danbooru_db_file(
    app: AppHandle,
    state: State<'_, DbState>,
    source_path: String,
) -> Result<RebuildDanbooruCacheResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let app_data = app_data_dir(&app)?;
    let source = PathBuf::from(&source_path);
    let dest = import_danbooru_db(&conn, &app_data, &source)?;
    let app_handle = app.clone();
    let cache_count = rebuild_character_cache(&conn, &dest, Some(|phase: String, count| {
        let message = match phase.as_str() {
            "opening" => "Danbooru DB を開いています…".to_string(),
            "importing" => format!("{count} 件読込中…"),
            "done" => format!("{count} 件のキャラタグを読み込みました"),
            _ => format!("{phase}: {count}"),
        };
        let _ = app_handle.emit(
            "danbooru-cache-progress",
            DanbooruCacheProgress {
                phase: phase.clone(),
                count,
                message,
            },
        );
    }))?;
    Ok(RebuildDanbooruCacheResult {
        cache_count,
        db_path: dest.to_string_lossy().to_string(),
    })
}
