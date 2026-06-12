use std::path::Path;

use rusqlite::{params, Connection};
use uuid::Uuid;
use walkdir::WalkDir;

use crate::db::connection::now_iso;
use crate::db::repositories::files as files_repo;
use crate::db::repositories::metadata as metadata_repo;
use crate::models::file::ScanResult;
use crate::services::metadata_extractor;
use crate::services::thumbnailer;

pub fn scan_folder(
    conn: &Connection,
    app_data: &Path,
    path: &str,
    recursive: bool,
    platform: &str,
) -> Result<ScanResult, String> {
    let root = Path::new(path);
    if !root.exists() {
        return Err(format!("Path not found: {path}"));
    }

    let walker = if recursive {
        WalkDir::new(root).into_iter()
    } else {
        WalkDir::new(root).max_depth(1).into_iter()
    };

    let mut scanned_count = 0u32;
    let mut image_count = 0u32;
    let mut error_count = 0u32;

    for entry in walker.filter_map(|e| e.ok()) {
        let entry_path = entry.path();
        if entry_path == root && entry_path.is_dir() {
            continue;
        }

        let (width, height) = if entry_path.is_file() {
            image_dimensions(entry_path)
        } else {
            (None, None)
        };

        match files_repo::build_entry_from_metadata(entry_path, width, height) {
            Ok(mut file_entry) => {
                if let Err(e) = files_repo::upsert_file(conn, &file_entry) {
                    error_count += 1;
                    eprintln!("upsert error: {e}");
                    continue;
                }
                scanned_count += 1;

                if file_entry.file_kind == "image" {
                    image_count += 1;
                    if let Ok(Some(meta)) =
                        metadata_extractor::extract_from_file(&file_entry.absolute_path, &file_entry.id)
                    {
                        let _ = metadata_repo::upsert_metadata(conn, &meta);
                    }
                    if let Ok(Some(thumb)) = thumbnailer::get_thumbnail_path(
                        conn,
                        app_data,
                        &file_entry.absolute_path,
                        &file_entry.id,
                        256,
                    ) {
                        file_entry.thumbnail_path = Some(thumb);
                    }
                }
            }
            Err(_) => error_count += 1,
        }
    }

    let folder_id = Uuid::new_v4().to_string();
    conn.execute(
        r#"
        INSERT INTO indexed_folders (id, platform, path, display_name, recursive, created_at, last_scanned_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "#,
        params![
            folder_id,
            platform,
            path,
            root.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path.to_string()),
            recursive as i64,
            now_iso(),
            now_iso(),
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(ScanResult {
        scanned_count,
        image_count,
        error_count,
    })
}

fn image_dimensions(path: &Path) -> (Option<i64>, Option<i64>) {
    match image::image_dimensions(path) {
        Ok((w, h)) => (Some(w as i64), Some(h as i64)),
        Err(_) => (None, None),
    }
}
