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
            commands::files::scan_photo_library_novelai,
            commands::files::cancel_photo_library_scan,
            plugins::folder_import::pick_import_folder,
            plugins::folder_import::pick_import_items,
            plugins::folder_import::pick_import_photos,
            commands::files::rename_file,
            commands::files::trash_file,
            commands::files::reveal_in_file_manager,
            commands::files::remove_from_library,
            commands::files::copy_file,
            commands::files::move_file,
            commands::files::batch_set_favorite,
            commands::files::batch_add_tag,
            commands::files::batch_trash,
            commands::files::batch_remove_from_library,
            commands::files::share_file,
            commands::files::get_storage_diagnostics,
            commands::files::diagnose_image_loading,
            commands::files::reconcile_ai_library,
            commands::collections::list_collections,
            commands::collections::create_collection,
            commands::collections::create_smart_collection,
            commands::collections::update_collection_keywords,
            commands::collections::batch_assign_smart_collections,
            commands::collections::diagnose_smart_assignment,
            commands::collections::list_character_suggestions,
            commands::collections::dismiss_character_suggestion,
            commands::collections::delete_collection,
            commands::collections::list_collection_files,
            commands::collections::add_file_to_collection,
            commands::collections::remove_file_from_collection,
            commands::danbooru::get_danbooru_index_status,
            commands::danbooru::set_danbooru_db_path,
            commands::danbooru::rebuild_danbooru_character_cache,
            commands::danbooru::import_danbooru_db_file,
            commands::maintenance::list_duplicate_files,
            commands::maintenance::backfill_content_hashes,
            commands::maintenance::backup_database,
            commands::metadata::extract_metadata,
            commands::metadata::get_metadata,
            commands::metadata::update_metadata,
            commands::tags::list_tags,
            commands::tags::create_tag,
            commands::tags::add_tag_to_file,
            commands::tags::remove_tag_from_file,
            commands::tags::get_file_tags,
            commands::tags::set_favorite,
            commands::prompt_tags::get_prompt_tag_settings,
            commands::prompt_tags::set_prompt_tag_settings,
            commands::prompt_tags::apply_prompt_tags_for_file,
            commands::prompt_tags::batch_apply_prompt_tags,
            commands::thumbnails::generate_thumbnail,
            commands::thumbnails::get_thumbnail,
            commands::search::search_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
