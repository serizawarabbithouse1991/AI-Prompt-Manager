use std::path::{Path, PathBuf};

use crate::platform;

pub fn rename_on_disk(path: &str, new_name: &str) -> Result<PathBuf, String> {
    let old = Path::new(path);
    let parent = old
        .parent()
        .ok_or_else(|| "Invalid path".to_string())?;
    let new_path = parent.join(new_name);
    if new_path.exists() {
        return Err("A file with that name already exists".to_string());
    }
    std::fs::rename(old, &new_path).map_err(|e| e.to_string())?;
    Ok(new_path)
}

pub fn trash(path: &str) -> Result<(), String> {
    platform::trash_file(path)
}

pub fn reveal(path: &str) -> Result<(), String> {
    platform::reveal_in_file_manager(path)
}

pub fn copy_on_disk(source: &str, dest_dir: &str) -> Result<PathBuf, String> {
    let src = Path::new(source);
    if !src.is_file() {
        return Err(format!("Not a file: {source}"));
    }
    let name = src
        .file_name()
        .ok_or_else(|| "Invalid source path".to_string())?;
    let dest = Path::new(dest_dir).join(name);
    if dest.exists() {
        return Err(format!("Destination already exists: {}", dest.display()));
    }
    std::fs::copy(src, &dest).map_err(|e| e.to_string())?;
    Ok(dest)
}

pub fn move_on_disk(source: &str, dest_dir: &str) -> Result<PathBuf, String> {
    let src = Path::new(source);
    if !src.is_file() {
        return Err(format!("Not a file: {source}"));
    }
    let name = src
        .file_name()
        .ok_or_else(|| "Invalid source path".to_string())?;
    let dest = Path::new(dest_dir).join(name);
    if dest.exists() {
        return Err(format!("Destination already exists: {}", dest.display()));
    }
    std::fs::rename(src, &dest).map_err(|e| e.to_string())?;
    Ok(dest)
}
