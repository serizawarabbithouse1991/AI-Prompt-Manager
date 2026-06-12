use std::path::{Path, PathBuf};

use crate::models::file::SpecialPaths;

pub mod android;
pub mod macos;
pub mod windows;

pub fn get_special_paths(app_data: &Path) -> Result<SpecialPaths, String> {
    #[cfg(target_os = "macos")]
    {
        return macos::get_special_paths(app_data);
    }
    #[cfg(target_os = "windows")]
    {
        return windows::get_special_paths(app_data);
    }
    #[cfg(target_os = "android")]
    {
        return android::get_special_paths(app_data);
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "android")))]
    {
        let home = dirs_fallback_home()?;
        Ok(SpecialPaths {
            home: home.clone(),
            desktop: home.clone(),
            downloads: home.clone(),
            pictures: home.clone(),
            ai_library: app_data.join("ai_library").to_string_lossy().to_string(),
        })
    }
}

pub fn ai_library_dir(app_data: &Path) -> PathBuf {
    app_data.join("ai_library")
}

pub fn thumbnails_dir(app_data: &Path, size: u32) -> PathBuf {
    app_data.join("thumbnails").join(size.to_string())
}

fn dirs_fallback_home() -> Result<String, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|e| e.to_string())
}

pub fn reveal_in_file_manager(path: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return macos::reveal_in_file_manager(path);
    }
    #[cfg(target_os = "windows")]
    {
        return windows::reveal_in_file_manager(path);
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = path;
        Err("Not supported on this platform".to_string())
    }
}

pub fn trash_file(path: &str) -> Result<(), String> {
    #[cfg(not(target_os = "android"))]
    {
        return trash::delete(path).map_err(|e| e.to_string());
    }
    #[cfg(target_os = "android")]
    {
        let _ = path;
        Err("Use remove_from_library on Android".to_string())
    }
}
