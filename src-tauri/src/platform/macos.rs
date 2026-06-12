use std::path::Path;

use crate::models::file::SpecialPaths;

pub fn get_special_paths(app_data: &Path) -> Result<SpecialPaths, String> {
    let home_dir = dirs::home_dir().ok_or_else(|| "Home directory not found".to_string())?;
    let home = home_dir.to_string_lossy().to_string();

    // iCloud Drive の NovelAI フォルダ（存在する場合のみ表示）
    let novel_ai = {
        let path = home_dir
            .join("Library/Mobile Documents/com~apple~CloudDocs/NovelAI");
        if path.is_dir() {
            Some(path.to_string_lossy().to_string())
        } else {
            None
        }
    };

    Ok(SpecialPaths {
        home: home.clone(),
        desktop: dirs::desktop_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| home.clone()),
        downloads: dirs::download_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| home.clone()),
        pictures: dirs::picture_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| home.clone()),
        ai_library: app_data.join("ai_library").to_string_lossy().to_string(),
        novel_ai,
    })
}

pub fn reveal_in_file_manager(path: &str) -> Result<(), String> {
    std::process::Command::new("open")
        .args(["-R", path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
