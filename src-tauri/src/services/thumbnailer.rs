use std::path::Path;

use image::imageops::FilterType;
use image::GenericImageView;
use image::ImageFormat;

use crate::db::repositories::thumbnails as thumb_repo;
use crate::platform::thumbnails_dir;
use crate::services::hash::{file_content_hash, path_to_id, thumbnail_path_for_hash};
use rusqlite::Connection;

pub fn generate_thumbnail(
    conn: &Connection,
    app_data: &Path,
    path: &str,
    size: u32,
) -> Result<String, String> {
    let file_id = path_to_id(path);
    let hash = file_content_hash(Path::new(path)).unwrap_or_else(|_| path_to_id(path));
    let output_path = thumbnail_path_for_hash(app_data, size, &hash);

    if output_path.exists() {
        let existing = output_path.to_string_lossy().to_string();
        thumb_repo::save_thumbnail(conn, &file_id, size, &existing)?;
        return Ok(existing);
    }

    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let img = image::open(path).map_err(|e| e.to_string())?;
    let (w, h) = img.dimensions();
    let max_dim = w.max(h).max(1);
    let scale = size as f32 / max_dim as f32;
    let new_w = ((w as f32 * scale).round() as u32).max(1);
    let new_h = ((h as f32 * scale).round() as u32).max(1);
    let thumb = img.resize(new_w, new_h, FilterType::Lanczos3);

    let mut buffer = std::fs::File::create(&output_path).map_err(|e| e.to_string())?;
    thumb
        .write_to(&mut buffer, ImageFormat::WebP)
        .map_err(|e| e.to_string())?;

    let output = output_path.to_string_lossy().to_string();
    thumb_repo::save_thumbnail(conn, &file_id, size, &output)?;
    Ok(output)
}

pub fn get_thumbnail_path(
    conn: &Connection,
    app_data: &Path,
    path: &str,
    file_id: &str,
    size: u32,
) -> Result<Option<String>, String> {
    if let Some(existing) = thumb_repo::get_thumbnail_path(conn, file_id, size)? {
        if Path::new(&existing).exists() {
            return Ok(Some(existing));
        }
    }
    match generate_thumbnail(conn, app_data, path, size) {
        Ok(p) => Ok(Some(p)),
        Err(_) => Ok(None),
    }
}

pub fn ensure_thumbnails_dir(app_data: &Path, size: u32) -> Result<(), String> {
    let dir = thumbnails_dir(app_data, size);
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())
}
