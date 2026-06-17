use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use rusqlite::Connection;
use uuid::Uuid;
use walkdir::WalkDir;
use zip::ZipArchive;

use crate::db::repositories::{files as files_repo, metadata as metadata_repo};
use crate::models::file::{detect_file_kind, ImportResult};
use crate::services::{character_matcher, hash::file_content_hash, metadata_extractor, prompt_tagger, thumbnailer};

enum ImportImageOutcome {
    Imported(crate::models::file::FileEntry),
    Skipped,
    Duplicate,
}

static PHOTO_SCAN_CANCELLED: AtomicBool = AtomicBool::new(false);

pub fn reset_photo_scan_cancel() {
    PHOTO_SCAN_CANCELLED.store(false, Ordering::SeqCst);
}

pub fn cancel_photo_scan() {
    PHOTO_SCAN_CANCELLED.store(true, Ordering::SeqCst);
}

pub fn is_photo_scan_cancelled() -> bool {
    PHOTO_SCAN_CANCELLED.load(Ordering::SeqCst)
}

pub fn import_paths(
    conn: &Connection,
    app_data: &Path,
    library_dir: &Path,
    uris: &[String],
    novelai_only: bool,
) -> Result<ImportResult, String> {
    fs::create_dir_all(library_dir).map_err(|e| e.to_string())?;
    let mut result = ImportResult::default();

    for uri in uris {
        match resolve_import_source(uri) {
            Ok(source) => import_at_path(conn, app_data, library_dir, &source, novelai_only, &mut result),
            Err(e) => {
                eprintln!("import skip: {e}");
                result.error_count += 1;
            }
        }
    }

    Ok(result)
}

pub fn import_staged_paths_with_progress<F>(
    conn: &Connection,
    app_data: &Path,
    library_dir: &Path,
    paths: &[String],
    novelai_only: bool,
    mut on_progress: F,
) -> Result<ImportResult, String>
where
    F: FnMut(usize, usize, &str, &ImportResult),
{
    let items: Vec<(String, String)> = paths
        .iter()
        .cloned()
        .map(|path| (path, String::new()))
        .collect();
    import_staged_photos_with_progress(conn, app_data, library_dir, &items, novelai_only, on_progress)
}

pub fn import_staged_photos_with_progress<F>(
    conn: &Connection,
    app_data: &Path,
    library_dir: &Path,
    items: &[(String, String)],
    novelai_only: bool,
    mut on_progress: F,
) -> Result<ImportResult, String>
where
    F: FnMut(usize, usize, &str, &ImportResult),
{
    use crate::db::repositories::photo_scan;

    fs::create_dir_all(library_dir).map_err(|e| e.to_string())?;
    let mut result = ImportResult::default();
    let total = items.len();
    let mut processed_ids: Vec<String> = Vec::new();

    for (index, (path, asset_id)) in items.iter().enumerate() {
        if is_photo_scan_cancelled() {
            break;
        }

        on_progress(index + 1, total, "NovelAI 判別・取込中", &result);

        let source = PathBuf::from(path);
        if path.is_empty() {
            result.skipped_count += 1;
            if !asset_id.is_empty() {
                processed_ids.push(asset_id.clone());
            }
            continue;
        }
        if !source.is_file() {
            result.error_count += 1;
            if !asset_id.is_empty() {
                processed_ids.push(asset_id.clone());
            }
            continue;
        }

        import_file(
            conn,
            app_data,
            library_dir,
            &source,
            novelai_only,
            &mut result,
        );

        let _ = fs::remove_file(&source);

        if !asset_id.is_empty() {
            processed_ids.push(asset_id.clone());
        }
    }

    if !processed_ids.is_empty() {
        photo_scan::mark_processed_batch(conn, &processed_ids)?;
    }

    Ok(result)
}

fn import_at_path(
    conn: &Connection,
    app_data: &Path,
    library_dir: &Path,
    path: &Path,
    novelai_only: bool,
    result: &mut ImportResult,
) {
    if path.is_dir() {
        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                import_file(
                    conn,
                    app_data,
                    library_dir,
                    entry.path(),
                    novelai_only,
                    result,
                );
            }
        }
        return;
    }

    import_file(conn, app_data, library_dir, path, novelai_only, result);
}

fn import_file(
    conn: &Connection,
    app_data: &Path,
    library_dir: &Path,
    path: &Path,
    novelai_only: bool,
    result: &mut ImportResult,
) {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext == "zip" {
        if novelai_only {
            result.skipped_count += 1;
            return;
        }
        let temp = app_data
            .join("import_temp")
            .join(Uuid::new_v4().to_string());
        match extract_zip(path, &temp) {
            Ok(()) => {
                result.zip_count += 1;
                import_at_path(conn, app_data, library_dir, &temp, novelai_only, result);
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

    match import_image_file(conn, app_data, library_dir, path, novelai_only) {
        Ok(ImportImageOutcome::Imported(entry)) => {
            result.imported_count += 1;
            result.image_count += 1;
            if novelai_only {
                result.novelai_count += 1;
            }
            if let Ok(assign) =
                character_matcher::assign_smart_collections_for_file(conn, app_data, &entry.id)
            {
                result.assigned_collection_count += assign.assigned_count;
                if assign.assigned_count == 0 {
                    if let Some(reason) = assign.skip_reason {
                        result.assign_skip_reason = Some(reason);
                    }
                }
            }
            if let Ok(settings) = prompt_tagger::get_prompt_tag_settings(conn) {
                if settings.auto_tag_on_import {
                    let mode = prompt_tagger::PromptTagMode::from_setting(&settings.mode);
                    if let Ok(tag_result) = prompt_tagger::apply_prompt_tags_for_file(
                        conn,
                        &entry.id,
                        &entry.absolute_path,
                        mode,
                    ) {
                        result.tags_added_count += tag_result.tags_added;
                    }
                }
            }
        }
        Ok(ImportImageOutcome::Skipped) => {
            result.skipped_count += 1;
        }
        Ok(ImportImageOutcome::Duplicate) => {
            result.duplicate_count += 1;
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
    novelai_only: bool,
) -> Result<ImportImageOutcome, String> {
    if novelai_only && !metadata_extractor::detect_novelai_from_file(&source.to_string_lossy())? {
        return Ok(ImportImageOutcome::Skipped);
    }

    let content_hash = file_content_hash(source)?;
    if let Some(existing) = files_repo::find_active_by_content_hash(conn, &content_hash)? {
        if Path::new(&existing.absolute_path).exists() {
            return Ok(ImportImageOutcome::Duplicate);
        }
    }

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
    entry.content_hash = Some(content_hash);

    files_repo::upsert_file(conn, &entry)?;
    if let Ok(Some(meta)) = metadata_extractor::extract_from_file(&path_str, &entry.id) {
        metadata_repo::upsert_metadata(conn, &meta)?;
    }
    if let Ok(Some(thumb)) =
        thumbnailer::get_thumbnail_path(conn, app_data, &path_str, &entry.id, 256)
    {
        entry.thumbnail_path = Some(thumb);
    }

    Ok(ImportImageOutcome::Imported(entry))
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
                if let Ok(ImportImageOutcome::Imported(entry)) =
                    import_image_file(conn, app_data, library_dir, entry.path(), false)
                {
                    last = Some(entry);
                }
            }
        }
        let _ = fs::remove_dir_all(&temp);
        return last.ok_or_else(|| "ZIP contains no images".to_string());
    }
    if !is_image_extension(&ext) {
        return Err(format!("Unsupported file type: {ext}"));
    }
    match import_image_file(conn, app_data, library_dir, &source, false)? {
        ImportImageOutcome::Imported(entry) => Ok(entry),
        ImportImageOutcome::Duplicate => Err("Duplicate image already in library".to_string()),
        ImportImageOutcome::Skipped => Err("Import failed".to_string()),
    }
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
