mod commands;
mod db;
mod models;
mod platform;
mod plugins;
mod services;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(plugins::folder_import::init())
        .setup(|app| {
            db::connection::init_db(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::files::get_platform_name,
            commands::files::list_directory,
            commands::files::get_special_paths,
            commands::files::scan_folder,
            commands::files::list_ai_library,
            commands::files::list_favorites,
            commands::files::import_from_saf,
            commands::files::import_paths,
            plugins::folder_import::pick_import_folder,
            plugins::folder_import::pick_import_items,
            plugins::folder_import::pick_import_photos,
            commands::files::rename_file,
            commands::files::trash_file,
            commands::files::reveal_in_file_manager,
            commands::files::remove_from_library,
            commands::metadata::extract_metadata,
            commands::metadata::get_metadata,
            commands::metadata::update_metadata,
            commands::tags::list_tags,
            commands::tags::create_tag,
            commands::tags::add_tag_to_file,
            commands::tags::remove_tag_from_file,
            commands::tags::get_file_tags,
            commands::tags::set_favorite,
            commands::thumbnails::generate_thumbnail,
            commands::thumbnails::get_thumbnail,
            commands::search::search_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
