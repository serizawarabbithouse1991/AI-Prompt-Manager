use std::fs;
use std::path::Path;

use tauri::AppHandle;

use crate::db::connection::{app_data_dir, with_conn};
use crate::db::repositories::files as files_repo;
use crate::models::file::{FileEntry, ScanResult, SpecialPaths};
use crate::platform::{self, ai_library_dir};
use crate::services::{file_ops, file_scanner, thumbnailer};

#[tauri::command]
pub fn get_platform_name() -> String {
    std::env::consts::OS.to_string()
}

#[tauri::command]
pub async fn list_directory(app: AppHandle, path: String) -> Result<Vec<FileEntry>, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err(format!("Not a directory: {path}"));
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        let (width, height) = if entry_path.is_file() {
            image::image_dimensions(&entry_path)
                .map(|(w, h)| (Some(w as i64), Some(h as i64)))
                .unwrap_or((None, None))
        } else {
            (None, None)
        };
        let mut file_entry =
            files_repo::build_entry_from_metadata(&entry_path, width, height)?;
        if file_entry.file_kind == "image" {
            let app_data = app_data_dir(&app)?;
            with_conn(&app, |conn| {
                if let Ok(Some(thumb)) = thumbnailer::get_thumbnail_path(
                    conn,
                    &app_data,
                    &file_entry.absolute_path,
                    &file_entry.id,
                    256,
                ) {
                    file_entry.thumbnail_path = Some(thumb);
                }
                Ok(())
            })?;
        }
        entries.push(file_entry);
    }

    entries.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then(a.display_name.to_lowercase().cmp(&b.display_name.to_lowercase()))
    });

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
        files_repo::attach_thumbnail_paths(conn, &mut files)?;
        Ok(files)
    })
}

#[tauri::command]
pub async fn list_favorites(app: AppHandle) -> Result<Vec<FileEntry>, String> {
    with_conn(&app, |conn| {
        let mut files = files_repo::list_favorites(conn)?;
        files_repo::attach_thumbnail_paths(conn, &mut files)?;
        Ok(files)
    })
}

#[tauri::command]
pub async fn import_from_saf(app: AppHandle, uri: String) -> Result<FileEntry, String> {
    let app_data = app_data_dir(&app)?;
    let dest = ai_library_dir(&app_data);
    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;

    let file_name = format!("import_{}.png", chrono::Utc::now().timestamp());
    let dest_path = dest.join(&file_name);

    #[cfg(target_os = "android")]
    {
        platform::android::import_from_saf(&uri, &dest)?;
    }

    #[cfg(not(target_os = "android"))]
    {
        if uri.starts_with("file://") {
            let source = uri.trim_start_matches("file://");
            std::fs::copy(source, &dest_path).map_err(|e| e.to_string())?;
        } else if Path::new(&uri).exists() {
            std::fs::copy(&uri, &dest_path).map_err(|e| e.to_string())?;
        } else {
            return Err("Invalid import URI".to_string());
        }
    }

    let path_str = dest_path.to_string_lossy().to_string();
    let (width, height) = image::image_dimensions(&dest_path)
        .map(|(w, h)| (Some(w as i64), Some(h as i64)))
        .unwrap_or((None, None));
    let mut entry = files_repo::build_entry_from_metadata(&dest_path, width, height)?;

    with_conn(&app, |conn| {
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
    })
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
