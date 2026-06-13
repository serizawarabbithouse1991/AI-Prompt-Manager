use std::fs;
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
        novel_ai: None,
    })
}

pub fn import_from_saf(uri: &str, dest_dir: &Path) -> Result<String, String> {
    fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;

    let source = Path::new(uri);
    if source.is_file() {
        let file_name = source
            .file_name()
            .ok_or_else(|| "Invalid source path".to_string())?
            .to_string_lossy()
            .to_string();
        let dest = dest_dir.join(&file_name);
        fs::copy(source, &dest).map_err(|e| e.to_string())?;
        return Ok(file_name);
    }

    if uri.starts_with("content://") {
        return Err(
            "content:// URI requires Android native integration; use file picker paths instead"
                .to_string(),
        );
    }

    Err(format!("Unsupported SAF URI: {uri}"))
}
