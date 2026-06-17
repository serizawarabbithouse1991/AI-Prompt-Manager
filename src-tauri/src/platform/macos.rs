use std::path::Path;

use crate::models::file::SpecialPaths;

pub fn get_special_paths(app_data: &Path) -> Result<SpecialPaths, String> {
    let home_dir = dirs::home_dir().ok_or_else(|| "Home directory not found".to_string())?;
    let home = home_dir.to_string_lossy().to_string();

    // iCloud Drive の NovelAI フォルダ（存在する場合のみ表示）
    let novel_ai = find_novelai_folder(&home_dir);

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

pub fn share_file(path: &str) -> Result<(), String> {
    let file = Path::new(path);
    if !file.is_file() {
        return Err(format!("Not a file: {path}"));
    }
    std::process::Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn find_novelai_folder(home_dir: &Path) -> Option<String> {
    let candidates = [
        home_dir.join("Library/Mobile Documents/com~apple~CloudDocs/NovelAI"),
        home_dir.join("Library/Mobile Documents/com~apple~CloudDocs/novelAI"),
    ];

    for path in candidates {
        if path.is_dir() {
            return Some(path.to_string_lossy().to_string());
        }
    }

    let cloud_storage = home_dir.join("Library/CloudStorage");
    if cloud_storage.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&cloud_storage) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_lowercase();
                if name.contains("icloud") && entry.path().join("NovelAI").is_dir() {
                    return Some(entry.path().join("NovelAI").to_string_lossy().to_string());
                }
            }
        }
    }

    None
}
