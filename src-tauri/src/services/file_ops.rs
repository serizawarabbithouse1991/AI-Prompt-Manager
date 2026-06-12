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
