use std::fs;
use std::path::Path;

use rusqlite::Connection;
use walkdir::WalkDir;

use crate::db::repositories::files as files_repo;
use crate::db::repositories::metadata as metadata_repo;
use crate::platform::ai_library_dir;
use crate::services::metadata_extractor;
use crate::services::thumbnailer;

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReconcileResult {
    pub disk_file_count: u32,
    pub db_library_count: u32,
    pub restored_count: u32,
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StorageDiagnostics {
    pub app_data_path: String,
    pub ai_library_path: String,
    pub database_path: String,
    pub database_bytes: u64,
    pub disk_file_count: u32,
    pub db_total_count: u32,
    pub db_library_count: u32,
    pub db_favorite_count: u32,
    pub processed_photo_count: u32,
}

pub fn normalize_storage_path(path: &str) -> String {
    path.strip_prefix("/private").unwrap_or(path).to_string()
}

pub fn ai_library_path_patterns(prefix: &str) -> Vec<String> {
    let mut patterns = vec![format!("{}%", prefix)];
    if let Some(stripped) = prefix.strip_prefix("/private") {
        patterns.push(format!("{}%", stripped));
    } else if prefix.starts_with('/') {
        patterns.push(format!("/private{}%", prefix));
    }
    patterns
}

pub fn count_disk_library_files(library_dir: &Path) -> Result<u32, String> {
    if !library_dir.is_dir() {
        return Ok(0);
    }
    let count = fs::read_dir(library_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_file())
        .count() as u32;
    Ok(count)
}

pub fn get_storage_diagnostics(conn: &Connection, app_data: &Path) -> Result<StorageDiagnostics, String> {
    let ai_library = ai_library_dir(app_data);
    let database_path = app_data.join("database.db");
    let database_bytes = fs::metadata(&database_path)
        .map(|meta| meta.len())
        .unwrap_or(0);

    let db_total_count: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM files WHERE is_deleted = 0 AND is_directory = 0",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let db_library_count = files_repo::count_ai_library(conn, &ai_library.to_string_lossy())?;
    let db_favorite_count: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM files WHERE is_deleted = 0 AND is_directory = 0 AND is_favorite = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let processed_photo_count: u32 = conn
        .query_row("SELECT COUNT(*) FROM processed_photo_assets", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    Ok(StorageDiagnostics {
        app_data_path: app_data.to_string_lossy().to_string(),
        ai_library_path: ai_library.to_string_lossy().to_string(),
        database_path: database_path.to_string_lossy().to_string(),
        database_bytes,
        disk_file_count: count_disk_library_files(&ai_library)?,
        db_total_count,
        db_library_count,
        db_favorite_count,
        processed_photo_count,
    })
}

pub fn reconcile_ai_library(conn: &Connection, app_data: &Path) -> Result<ReconcileResult, String> {
    let library_dir = ai_library_dir(app_data);
    fs::create_dir_all(&library_dir).map_err(|e| e.to_string())?;

    let disk_file_count = count_disk_library_files(&library_dir)?;
    let db_library_count =
        files_repo::count_ai_library(conn, &library_dir.to_string_lossy())?;
    let mut restored_count = 0u32;

    for entry in WalkDir::new(&library_dir)
        .min_depth(1)
        .max_depth(1)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
    {
        let path = entry.path();
        if files_repo::find_active_by_path_variants(conn, path)?.is_some() {
            continue;
        }

        let (width, height) = image::image_dimensions(path)
            .map(|(w, h)| (Some(w as i64), Some(h as i64)))
            .unwrap_or((None, None));
        let mut file_entry = files_repo::build_entry_from_metadata(path, width, height)?;
        files_repo::upsert_file(conn, &file_entry)?;

        let path_str = file_entry.absolute_path.clone();
        if let Ok(Some(meta)) = metadata_extractor::extract_from_file(&path_str, &file_entry.id) {
            let _ = metadata_repo::upsert_metadata(conn, &meta);
        }
        if let Ok(Some(thumb)) =
            thumbnailer::get_thumbnail_path(conn, app_data, &path_str, &file_entry.id, 256)
        {
            file_entry.thumbnail_path = Some(thumb);
        }

        restored_count += 1;
    }

    if restored_count > 0 {
        eprintln!(
            "library_reconcile: restored {restored_count} files (disk={disk_file_count}, db_before={db_library_count})"
        );
    }

    Ok(ReconcileResult {
        disk_file_count,
        db_library_count,
        restored_count,
    })
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BackfillResult {
    pub updated_count: u32,
    pub skipped_count: u32,
    pub error_count: u32,
}

pub fn backfill_content_hashes(conn: &Connection, app_data: &Path) -> Result<BackfillResult, String> {
    let library_dir = ai_library_dir(app_data);
    let mut updated_count = 0u32;
    let mut skipped_count = 0u32;
    let mut error_count = 0u32;

    let mut stmt = conn
        .prepare(
            "SELECT id, absolute_path, content_hash FROM files WHERE is_deleted = 0 AND is_directory = 0 AND absolute_path LIKE ?1",
        )
        .map_err(|e| e.to_string())?;
    let pattern = format!("{}%", library_dir.to_string_lossy());
    let rows = stmt
        .query_map([&pattern], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        let (id, path, existing) = row.map_err(|e| e.to_string())?;
        if existing.is_some() {
            skipped_count += 1;
            continue;
        }
        let path_obj = std::path::Path::new(&path);
        if !path_obj.is_file() {
            skipped_count += 1;
            continue;
        }
        match crate::services::hash::file_content_hash(path_obj) {
            Ok(hash) => {
                conn.execute(
                    "UPDATE files SET content_hash = ?1 WHERE id = ?2",
                    rusqlite::params![hash, id],
                )
                .map_err(|e| e.to_string())?;
                updated_count += 1;
            }
            Err(_) => error_count += 1,
        }
    }

    Ok(BackfillResult {
        updated_count,
        skipped_count,
        error_count,
    })
}

pub fn backup_database(app_data: &Path) -> Result<String, String> {
    let src = app_data.join("database.db");
    if !src.exists() {
        return Err("database.db not found".to_string());
    }
    let stamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let dest = app_data.join(format!("database_backup_{stamp}.db"));
    std::fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}
