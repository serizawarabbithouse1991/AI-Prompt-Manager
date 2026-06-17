use std::fs;
use std::path::Path;

use tauri::{AppHandle, Emitter};

use crate::db::connection::{app_data_dir, with_conn};
use crate::db::repositories::files as files_repo;
use crate::models::file::{FileEntry, ImportResult, ScanResult, SpecialPaths};
use crate::platform::{self, ai_library_dir};
use crate::services::{file_ops, file_scanner, import_service, library_reconcile};

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRef {
    pub file_id: String,
    pub absolute_path: String,
}

#[tauri::command]
pub fn get_platform_name() -> String {
    std::env::consts::OS.to_string()
}

#[tauri::command]
pub async fn list_directory(
    app: AppHandle,
    path: String,
    images_only: Option<bool>,
) -> Result<Vec<FileEntry>, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err(format!("Not a directory: {path}"));
    }

    let images_only = images_only.unwrap_or(false);

    // パフォーマンス重視: 一覧取得ではサムネイルを生成しない（既存のものだけ DB から付与）。
    // 生成はスキャン時・ファイル選択時に行う。
    let mut entries = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        let file_name = entry_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        if file_name.starts_with('.') {
            continue;
        }
        if images_only {
            let is_dir = entry_path.is_dir();
            if !is_dir {
                let ext = entry_path
                    .extension()
                    .map(|e| e.to_string_lossy().to_lowercase())
                    .unwrap_or_default();
                let is_image = matches!(
                    ext.as_str(),
                    "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" | "heic" | "heif"
                );
                if !is_image {
                    continue;
                }
            }
        }
        match files_repo::build_entry_from_metadata(&entry_path, None, None) {
            Ok(file_entry) => entries.push(file_entry),
            Err(_) => continue,
        }
    }

    entries.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then(a.display_name.to_lowercase().cmp(&b.display_name.to_lowercase()))
    });

    with_conn(&app, |conn| files_repo::attach_db_metadata(conn, &mut entries))?;

    Ok(entries)
}

#[tauri::command]
pub async fn get_special_paths(app: AppHandle) -> Result<SpecialPaths, String> {
    let app_data = app_data_dir(&app)?;
    std::fs::create_dir_all(ai_library_dir(&app_data)).map_err(|e| e.to_string())?;
    platform::get_special_paths(&app_data)
}

#[tauri::command]
pub async fn scan_folder(
    app: AppHandle,
    path: String,
    recursive: bool,
) -> Result<ScanResult, String> {
    let app_data = app_data_dir(&app)?;
    let platform_name = std::env::consts::OS.to_string();
    with_conn(&app, |conn| {
        file_scanner::scan_folder(conn, &app_data, &path, recursive, &platform_name)
    })
}

#[tauri::command]
pub async fn list_ai_library(app: AppHandle) -> Result<Vec<FileEntry>, String> {
    let app_data = app_data_dir(&app)?;
    let ai_lib = ai_library_dir(&app_data).to_string_lossy().to_string();
    with_conn(&app, |conn| {
        let mut files = files_repo::list_ai_library(conn, &ai_lib)?;
        files_repo::attach_db_metadata(conn, &mut files)?;
        Ok(files)
    })
}

#[tauri::command]
pub async fn list_favorites(app: AppHandle) -> Result<Vec<FileEntry>, String> {
    with_conn(&app, |conn| {
        let mut files = files_repo::list_favorites(conn)?;
        files_repo::attach_db_metadata(conn, &mut files)?;
        Ok(files)
    })
}

#[tauri::command]
pub async fn import_from_saf(app: AppHandle, uri: String) -> Result<FileEntry, String> {
    let app_data = app_data_dir(&app)?;
    let dest = ai_library_dir(&app_data);

    #[cfg(target_os = "android")]
    {
        let imported = platform::android::import_from_saf(&uri, &dest)?;
        let dest_path = dest.join(imported);
        let path_str = dest_path.to_string_lossy().to_string();
        let (width, height) = image::image_dimensions(&dest_path)
            .map(|(w, h)| (Some(w as i64), Some(h as i64)))
            .unwrap_or((None, None));
        let mut entry = files_repo::build_entry_from_metadata(&dest_path, width, height)?;
        return with_conn(&app, |conn| {
            files_repo::upsert_file(conn, &entry)?;
            if let Ok(Some(meta)) =
                crate::services::metadata_extractor::extract_from_file(&path_str, &entry.id)
            {
                crate::db::repositories::metadata::upsert_metadata(conn, &meta)?;
            }
            if let Ok(Some(thumb)) = thumbnailer::get_thumbnail_path(
                conn,
                &app_data,
                &path_str,
                &entry.id,
                256,
            ) {
                entry.thumbnail_path = Some(thumb);
            }
            Ok(entry)
        });
    }

    #[cfg(not(target_os = "android"))]
    {
        with_conn(&app, |conn| import_service::import_single_file(conn, &app_data, &dest, &uri))
    }
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ImportProgressPayload {
    current: usize,
    total: usize,
    message: String,
    phase: String,
    novelai_count: u32,
    skipped_count: u32,
    eta_seconds: Option<u64>,
}

fn compute_eta_seconds(current: usize, total: usize, elapsed_secs: f64) -> Option<u64> {
    if current == 0 || current >= total || elapsed_secs <= 0.0 {
        return None;
    }
    let rate = current as f64 / elapsed_secs;
    if rate <= 0.0 {
        return None;
    }
    Some(((total - current) as f64 / rate).ceil() as u64)
}

fn emit_import_progress(
    app: &AppHandle,
    current: usize,
    total: usize,
    message: &str,
    phase: &str,
    novelai_count: u32,
    skipped_count: u32,
    eta_seconds: Option<u64>,
) {
    let _ = app.emit(
        "import-progress",
        ImportProgressPayload {
            current,
            total,
            message: message.to_string(),
            phase: phase.to_string(),
            novelai_count,
            skipped_count,
            eta_seconds,
        },
    );
}

#[tauri::command]
pub async fn import_paths(
    app: AppHandle,
    paths: Vec<String>,
    novelai_only: Option<bool>,
) -> Result<ImportResult, String> {
    let app_data = app_data_dir(&app)?;
    let dest = ai_library_dir(&app_data);
    let novelai_only = novelai_only.unwrap_or(false);
    with_conn(&app, |conn| {
        import_service::import_paths(conn, &app_data, &dest, &paths, novelai_only)
    })
}

#[tauri::command]
pub async fn scan_photo_library_novelai(
    app: AppHandle,
    incremental: Option<bool>,
    png_only: Option<bool>,
) -> Result<ImportResult, String> {
    use std::time::Instant;

    import_service::reset_photo_scan_cancel();

    let incremental = incremental.unwrap_or(true);
    let png_only = png_only.unwrap_or(true);
    let exclude_ids = if incremental {
        with_conn(&app, |conn| {
            crate::db::repositories::photo_scan::list_processed_asset_ids(conn)
        })?
    } else {
        Vec::new()
    };

    let app_handle = app.clone();
    emit_import_progress(
        &app,
        0,
        0,
        if incremental {
            "新しい写真を確認中…"
        } else {
            "写真ライブラリを準備中…"
        },
        "export",
        0,
        0,
        None,
    );

    let export_start = Instant::now();
    let exported = crate::plugins::folder_import::export_photo_library_with_progress(
        app.clone(),
        exclude_ids,
        png_only,
        |current, total| {
            let eta = compute_eta_seconds(current, total, export_start.elapsed().as_secs_f64());
            emit_import_progress(
                &app_handle,
                current,
                total,
                if png_only {
                    "PNG を確認・書き出し中"
                } else {
                    "写真を書き出し中"
                },
                "export",
                0,
                0,
                eta,
            );
        },
    )
    .await?;

    if import_service::is_photo_scan_cancelled() {
        emit_import_progress(&app, 0, 0, "スキャンを中断しました", "import", 0, 0, None);
        return Ok(ImportResult::default());
    }

    if exported.is_empty() {
        emit_import_progress(&app, 0, 0, "新しい写真はありません", "import", 0, 0, None);
        return Ok(ImportResult::default());
    }

    let app_data = app_data_dir(&app)?;
    let dest = ai_library_dir(&app_data);
    let total = exported.len();
    let staged: Vec<(String, String)> = exported
        .into_iter()
        .map(|item| (item.path, item.asset_id))
        .collect();

    emit_import_progress(
        &app,
        0,
        total,
        "NovelAI 判別・取込を開始",
        "import",
        0,
        0,
        None,
    );

    let import_start = Instant::now();
    let result = with_conn(&app, |conn| {
        import_service::import_staged_photos_with_progress(
            conn,
            &app_data,
            &dest,
            &staged,
            true,
            |current, total, message, partial| {
                let eta = compute_eta_seconds(current, total, import_start.elapsed().as_secs_f64());
                emit_import_progress(
                    &app_handle,
                    current,
                    total,
                    message,
                    "import",
                    partial.novelai_count,
                    partial.skipped_count,
                    eta,
                );
            },
        )
    })?;

    Ok(result)
}

#[tauri::command]
pub async fn cancel_photo_library_scan(app: AppHandle) -> Result<(), String> {
    import_service::cancel_photo_scan();
    crate::plugins::folder_import::cancel_photo_library_export_plugin(&app);
    Ok(())
}

#[tauri::command]
pub async fn rename_file(
    app: AppHandle,
    path: String,
    new_name: String,
) -> Result<FileEntry, String> {
    let new_path = file_ops::rename_on_disk(&path, &new_name)?;
    let new_path_str = new_path.to_string_lossy().to_string();
    with_conn(&app, |conn| {
        files_repo::update_path(conn, &path, &new_path_str, &new_name)
    })
}

#[tauri::command]
pub async fn trash_file(app: AppHandle, path: String) -> Result<(), String> {
    file_ops::trash(&path)?;
    with_conn(&app, |conn| files_repo::mark_deleted(conn, &path))
}

#[tauri::command]
pub async fn reveal_in_file_manager(path: String) -> Result<(), String> {
    file_ops::reveal(&path)
}

#[tauri::command]
pub async fn remove_from_library(app: AppHandle, file_id: String) -> Result<(), String> {
    with_conn(&app, |conn| {
        let file = files_repo::get_by_id(conn, &file_id)?
            .ok_or_else(|| "File not found".to_string())?;
        if Path::new(&file.absolute_path).exists() {
            std::fs::remove_file(&file.absolute_path).map_err(|e| e.to_string())?;
        }
        files_repo::mark_deleted(conn, &file.absolute_path)
    })
}

#[tauri::command]
pub async fn copy_file(
    app: AppHandle,
    source: String,
    dest_dir: String,
) -> Result<FileEntry, String> {
    let new_path = file_ops::copy_on_disk(&source, &dest_dir)?;
    with_conn(&app, |conn| {
        let entry = files_repo::build_entry_from_metadata(&new_path, None, None)?;
        files_repo::upsert_file(conn, &entry)?;
        Ok(entry)
    })
}

#[tauri::command]
pub async fn move_file(
    app: AppHandle,
    source: String,
    dest_dir: String,
) -> Result<FileEntry, String> {
    let new_path = file_ops::move_on_disk(&source, &dest_dir)?;
    let old_path = source;
    let new_path_str = new_path.to_string_lossy().to_string();
    let new_name = new_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    with_conn(&app, |conn| files_repo::update_path(conn, &old_path, &new_path_str, &new_name))
}

#[tauri::command]
pub async fn batch_set_favorite(
    app: AppHandle,
    files: Vec<FileRef>,
    is_favorite: bool,
) -> Result<(), String> {
    with_conn(&app, |conn| {
        for file in files {
            files_repo::set_favorite_with_upsert(
                conn,
                &file.file_id,
                &file.absolute_path,
                is_favorite,
            )?;
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn batch_add_tag(
    app: AppHandle,
    files: Vec<FileRef>,
    tag_id: String,
) -> Result<(), String> {
    with_conn(&app, |conn| {
        for file in files {
            crate::db::repositories::tags::add_tag_with_upsert(
                conn,
                &file.file_id,
                &file.absolute_path,
                &tag_id,
            )?;
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn batch_trash(app: AppHandle, paths: Vec<String>) -> Result<(), String> {
    for path in paths {
        file_ops::trash(&path)?;
        with_conn(&app, |conn| files_repo::mark_deleted(conn, &path))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn batch_remove_from_library(
    app: AppHandle,
    file_ids: Vec<String>,
) -> Result<(), String> {
    with_conn(&app, |conn| {
        for file_id in file_ids {
            let file = files_repo::get_by_id(conn, &file_id)?
                .ok_or_else(|| format!("File not found: {file_id}"))?;
            if Path::new(&file.absolute_path).exists() {
                std::fs::remove_file(&file.absolute_path).map_err(|e| e.to_string())?;
            }
            files_repo::mark_deleted(conn, &file.absolute_path)?;
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn share_file(app: AppHandle, path: String) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        return crate::plugins::folder_import::share_file_ios(app, path).await;
    }

    #[cfg(not(target_os = "ios"))]
    {
        let _ = app;
        crate::platform::share_file(&path)
    }
}

#[tauri::command]
pub async fn diagnose_image_loading(
    app: AppHandle,
    sample_limit: Option<u32>,
) -> Result<library_reconcile::ImageLoadingDiagnosis, String> {
    let app_data = app_data_dir(&app)?;
    let limit = sample_limit.unwrap_or(20);
    with_conn(&app, |conn| library_reconcile::diagnose_image_loading(conn, &app_data, limit))
}

#[tauri::command]
pub async fn get_storage_diagnostics(
    app: AppHandle,
) -> Result<library_reconcile::StorageDiagnostics, String> {
    let app_data = app_data_dir(&app)?;
    with_conn(&app, |conn| library_reconcile::get_storage_diagnostics(conn, &app_data))
}

#[tauri::command]
pub async fn reconcile_ai_library(
    app: AppHandle,
) -> Result<library_reconcile::ReconcileResult, String> {
    let app_data = app_data_dir(&app)?;
    with_conn(&app, |conn| library_reconcile::reconcile_ai_library(conn, &app_data))
}
