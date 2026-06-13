use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::Connection;
use uuid::Uuid;
use walkdir::WalkDir;
use zip::ZipArchive;

use crate::db::repositories::{files as files_repo, metadata as metadata_repo};
use crate::models::file::{detect_file_kind, ImportResult};
use crate::services::{metadata_extractor, thumbnailer};

pub fn import_paths(
    conn: &Connection,
    app_data: &Path,
    library_dir: &Path,
    uris: &[String],
) -> Result<ImportResult, String> {
    fs::create_dir_all(library_dir).map_err(|e| e.to_string())?;
    let mut result = ImportResult {
        imported_count: 0,
        image_count: 0,
        zip_count: 0,
        error_count: 0,
    };

    for uri in uris {
        match resolve_import_source(uri) {
            Ok(source) => import_at_path(conn, app_data, library_dir, &source, &mut result),
            Err(e) => {
                eprintln!("import skip: {e}");
                result.error_count += 1;
            }
        }
    }

    Ok(result)
}

fn import_at_path(
    conn: &Connection,
    app_data: &Path,
    library_dir: &Path,
    path: &Path,
    result: &mut ImportResult,
) {
    if path.is_dir() {
        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                import_file(conn, app_data, library_dir, entry.path(), result);
            }
        }
        return;
    }

    import_file(conn, app_data, library_dir, path, result);
}

fn import_file(
    conn: &Connection,
    app_data: &Path,
    library_dir: &Path,
    path: &Path,
    result: &mut ImportResult,
) {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext == "zip" {
        let temp = app_data
            .join("import_temp")
            .join(Uuid::new_v4().to_string());
        match extract_zip(path, &temp) {
            Ok(()) => {
                result.zip_count += 1;
                import_at_path(conn, app_data, library_dir, &temp, result);
                let _ = fs::remove_dir_all(&temp);
            }
            Err(e) => {
                eprintln!("zip extract error: {e}");
                result.error_count += 1;
            }
        }
        return;
    }

    if !is_image_extension(&ext) {
        return;
    }

    match import_image_file(conn, app_data, library_dir, path) {
        Ok(_) => {
            result.imported_count += 1;
            result.image_count += 1;
        }
        Err(e) => {
            eprintln!("import image error: {e}");
            result.error_count += 1;
        }
    }
}

fn import_image_file(
    conn: &Connection,
    app_data: &Path,
    library_dir: &Path,
    source: &Path,
) -> Result<crate::models::file::FileEntry, String> {
    let source_name = source
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "import.png".to_string());
    let stamp = chrono::Utc::now().timestamp();
    let dest_path = library_dir.join(format!("import_{stamp}_{source_name}"));

    fs::copy(source, &dest_path).map_err(|e| e.to_string())?;

    let path_str = dest_path.to_string_lossy().to_string();
    let (width, height) = image::image_dimensions(&dest_path)
        .map(|(w, h)| (Some(w as i64), Some(h as i64)))
        .unwrap_or((None, None));
    let mut entry = files_repo::build_entry_from_metadata(&dest_path, width, height)?;

    files_repo::upsert_file(conn, &entry)?;
    if let Ok(Some(meta)) = metadata_extractor::extract_from_file(&path_str, &entry.id) {
        metadata_repo::upsert_metadata(conn, &meta)?;
    }
    if let Ok(Some(thumb)) =
        thumbnailer::get_thumbnail_path(conn, app_data, &path_str, &entry.id, 256)
    {
        entry.thumbnail_path = Some(thumb);
    }

    Ok(entry)
}

fn extract_zip(zip_path: &Path, dest: &Path) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        if entry.is_dir() {
            continue;
        }
        let Some(relative) = entry.enclosed_name().map(|p| p.to_path_buf()) else {
            continue;
        };
        let out = dest.join(relative);
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut out_file = fs::File::create(&out).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut out_file).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn is_image_extension(ext: &str) -> bool {
    detect_file_kind(ext, false) == "image"
}

pub fn import_single_file(
    conn: &Connection,
    app_data: &Path,
    library_dir: &Path,
    uri: &str,
) -> Result<crate::models::file::FileEntry, String> {
    fs::create_dir_all(library_dir).map_err(|e| e.to_string())?;
    let source = resolve_import_source(uri)?;
    if source.is_dir() {
        return Err("Expected a file path".to_string());
    }
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if ext == "zip" {
        let temp = app_data
            .join("import_temp")
            .join(Uuid::new_v4().to_string());
        extract_zip(&source, &temp)?;
        let mut last: Option<crate::models::file::FileEntry> = None;
        for entry in WalkDir::new(&temp).into_iter().filter_map(|e| e.ok()) {
            if !entry.file_type().is_file() {
                continue;
            }
            let file_ext = entry
                .path()
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            if is_image_extension(&file_ext) {
                last = Some(import_image_file(
                    conn,
                    app_data,
                    library_dir,
                    entry.path(),
                )?);
            }
        }
        let _ = fs::remove_dir_all(&temp);
        return last.ok_or_else(|| "ZIP contains no images".to_string());
    }
    if !is_image_extension(&ext) {
        return Err(format!("Unsupported file type: {ext}"));
    }
    import_image_file(conn, app_data, library_dir, &source)
}

pub fn resolve_import_source(uri: &str) -> Result<PathBuf, String> {
    if uri.starts_with("file://") {
        let raw = uri.trim_start_matches("file://");
        let path = if raw.starts_with('/') {
            raw.to_string()
        } else {
            format!("/{raw}")
        };
        let path = PathBuf::from(path);
        if path.exists() {
            return Ok(path);
        }
    }

    let direct = PathBuf::from(uri);
    if direct.exists() {
        return Ok(direct);
    }

    Err(format!("Invalid import URI: {uri}"))
}
