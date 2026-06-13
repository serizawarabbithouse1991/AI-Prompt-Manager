use std::path::Path;

use crate::models::file::SpecialPaths;

pub fn get_special_paths(app_data: &Path) -> Result<SpecialPaths, String> {
    let ai_library = app_data.join("ai_library");
    std::fs::create_dir_all(&ai_library).map_err(|e| e.to_string())?;
    let ai_library_str = ai_library.to_string_lossy().to_string();
    Ok(SpecialPaths {
        home: ai_library_str.clone(),
        desktop: ai_library_str.clone(),
        downloads: ai_library_str.clone(),
        pictures: ai_library_str.clone(),
        ai_library: ai_library_str,
        novel_ai: None,
    })
}
