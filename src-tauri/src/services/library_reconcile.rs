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
    pub pruned_count: u32,
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
    pub missing_db_file_count: u32,
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageLoadingSample {
    pub file_id: String,
    pub absolute_path: String,
    pub file_exists: bool,
    pub thumbnail_path: Option<String>,
    pub thumbnail_exists: bool,
    pub extension: Option<String>,
    pub asset_url_sample: String,
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageLoadingDiagnosis {
    pub total_library_count: u32,
    pub missing_file_count: u32,
    pub samples: Vec<ImageLoadingSample>,
}

pub fn normalize_storage_path(path: &str) -> String {
    path.strip_prefix("/private").unwrap_or(path).to_string()
}

/// Path form used by Tauri `convertFileSrc` / iOS `asset://localhost` handler.
pub fn normalize_path_for_asset(path: &str) -> String {
    normalize_storage_path(path)
}

pub fn asset_url_sample(path: &str) -> String {
    format!("asset://localhost{}", normalize_path_for_asset(path))
}

pub fn path_variants(path: &str) -> Vec<String> {
    let mut variants = vec![path.to_string()];
    let normalized = normalize_storage_path(path);
    if normalized != path {
        variants.push(normalized);
    }
    if !path.starts_with("/private") {
        variants.push(format!("/private{path}"));
    }
    variants
}

pub fn path_exists_on_disk(path: &str) -> bool {
    path_variants(path)
        .iter()
        .any(|candidate| Path::new(candidate).exists())
}

pub fn resolve_existing_path(path: &str) -> Option<String> {
    for candidate in path_variants(path) {
        if Path::new(&candidate).exists() {
            return Some(normalize_path_for_asset(&candidate));
        }
    }
    None
}

pub fn count_missing_library_files(conn: &Connection, ai_library_prefix: &str) -> Result<u32, String> {
    let files = files_repo::list_ai_library(conn, ai_library_prefix)?;
    Ok(files
        .iter()
        .filter(|file| !path_exists_on_disk(&file.absolute_path))
        .count() as u32)
}

pub fn prepare_files_for_asset_display(files: &mut Vec<crate::models::file::FileEntry>) {
    files.retain_mut(|file| {
        if file.is_directory {
            return true;
        }
        let Some(resolved) = resolve_existing_path(&file.absolute_path) else {
            return false;
        };
        file.absolute_path = resolved;
        if let Some(thumb) = file.thumbnail_path.clone() {
            if let Some(resolved_thumb) = resolve_existing_path(&thumb) {
                file.thumbnail_path = Some(resolved_thumb);
            } else {
                file.thumbnail_path = None;
            }
        }
        true
    });
}

pub fn prune_missing_library_files(conn: &Connection, ai_library_prefix: &str) -> Result<u32, String> {
    let files = files_repo::list_ai_library(conn, ai_library_prefix)?;
    let mut pruned = 0u32;
    for file in files {
        if path_exists_on_disk(&file.absolute_path) {
            continue;
        }
        conn.execute(
            "UPDATE files SET is_deleted = 1 WHERE id = ?1",
            rusqlite::params![file.id],
        )
        .map_err(|e| e.to_string())?;
        pruned += 1;
    }
    if pruned > 0 {
        eprintln!("library_reconcile: pruned {pruned} missing file record(s)");
    }
    Ok(pruned)
}

pub fn diagnose_image_loading(
    conn: &Connection,
    app_data: &Path,
    sample_limit: u32,
) -> Result<ImageLoadingDiagnosis, String> {
    let ai_library = ai_library_dir(app_data);
    let prefix = ai_library.to_string_lossy().to_string();
    let files = files_repo::list_ai_library(conn, &prefix)?;
    let total_library_count = files.len() as u32;
    let missing_file_count = files
        .iter()
        .filter(|file| !path_exists_on_disk(&file.absolute_path))
        .count() as u32;

    let limit = sample_limit.max(1).min(50) as usize;
    let mut samples = Vec::new();
    for file in files.iter().take(limit) {
        let thumb: Option<String> = conn
            .query_row(
                "SELECT local_path FROM thumbnails WHERE file_id = ?1 AND size = 256 LIMIT 1",
                rusqlite::params![file.id],
                |row| row.get(0),
            )
            .ok();
        let resolved = resolve_existing_path(&file.absolute_path);
        let asset_path = resolved
            .clone()
            .unwrap_or_else(|| normalize_path_for_asset(&file.absolute_path));
        samples.push(ImageLoadingSample {
            file_id: file.id.clone(),
            absolute_path: file.absolute_path.clone(),
            file_exists: path_exists_on_disk(&file.absolute_path),
            thumbnail_path: thumb.clone(),
            thumbnail_exists: thumb
                .as_deref()
                .map(path_exists_on_disk)
                .unwrap_or(false),
            extension: file.extension.clone(),
            asset_url_sample: asset_url_sample(&asset_path),
        });
    }

    Ok(ImageLoadingDiagnosis {
        total_library_count,
        missing_file_count,
        samples,
    })
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

    let missing_db_file_count = count_missing_library_files(conn, &ai_library.to_string_lossy())?;

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
        missing_db_file_count,
    })
}

pub fn reconcile_ai_library(conn: &Connection, app_data: &Path) -> Result<ReconcileResult, String> {
    let library_dir = ai_library_dir(app_data);
    fs::create_dir_all(&library_dir).map_err(|e| e.to_string())?;

    let prefix = library_dir.to_string_lossy().to_string();
    let pruned_count = prune_missing_library_files(conn, &prefix)?;

    let disk_file_count = count_disk_library_files(&library_dir)?;
    let db_library_count = files_repo::count_ai_library(conn, &prefix)?;
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

    if restored_count > 0 || pruned_count > 0 {
        eprintln!(
            "library_reconcile: restored {restored_count}, pruned {pruned_count} (disk={disk_file_count}, db={db_library_count})"
        );
    }

    Ok(ReconcileResult {
        disk_file_count,
        db_library_count,
        restored_count,
        pruned_count,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_path_for_asset_strips_private_prefix() {
        assert_eq!(
            normalize_path_for_asset("/private/var/mobile/foo.png"),
            "/var/mobile/foo.png"
        );
        assert_eq!(
            normalize_path_for_asset("/var/mobile/foo.png"),
            "/var/mobile/foo.png"
        );
    }

    #[test]
    fn asset_url_sample_uses_normalized_path() {
        assert_eq!(
            asset_url_sample("/private/var/mobile/foo.png"),
            "asset://localhost/var/mobile/foo.png"
        );
    }
}
