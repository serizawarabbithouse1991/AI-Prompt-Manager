use std::path::Path;

use crate::models::file::SpecialPaths;

pub fn get_special_paths(app_data: &Path) -> Result<SpecialPaths, String> {
    let ai_library = app_data.join("ai_library");
    std::fs::create_dir_all(&ai_library).map_err(|e| e.to_string())?;
    Ok(SpecialPaths {
        home: ai_library.to_string_lossy().to_string(),
        desktop: ai_library.to_string_lossy().to_string(),
        downloads: ai_library.to_string_lossy().to_string(),
        pictures: ai_library.to_string_lossy().to_string(),
        ai_library: ai_library.to_string_lossy().to_string(),
    })
}

pub fn import_from_saf(_uri: &str, dest_dir: &Path) -> Result<String, String> {
    std::fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;
    Err("SAF import requires Android JNI integration; stub on other platforms".to_string())
}
