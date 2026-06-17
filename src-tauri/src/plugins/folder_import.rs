use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, PluginHandle, TauriPlugin},
    AppHandle, Manager, Runtime,
};

#[cfg(target_os = "ios")]
const PHOTO_LIBRARY_BATCH_SIZE: u32 = 8;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_folder_import);

#[cfg(target_os = "ios")]
struct FolderImportPlugin<R: Runtime>(PluginHandle<R>);

#[derive(Debug, Deserialize)]
struct PickFolderResponse {
    path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PickItemsResponse {
    paths: Option<Vec<String>>,
}

#[cfg(target_os = "ios")]
#[derive(Debug, Deserialize)]
struct BeginPhotoLibraryScanResponse {
    #[serde(rename = "sessionId")]
    session_id: Option<String>,
    total: u32,
}

#[cfg(target_os = "ios")]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BeginPhotoLibraryScanArgs {
    exclude_local_identifiers: Vec<String>,
    png_only: bool,
    novelai_probe: bool,
}

#[cfg(target_os = "ios")]
#[derive(Debug, Deserialize)]
struct ExportedPhotoItem {
    path: String,
    #[serde(rename = "assetId")]
    asset_id: String,
}

#[cfg(target_os = "ios")]
#[derive(Debug, Deserialize)]
struct ExportPhotoLibraryBatchResponse {
    items: Option<Vec<ExportedPhotoItem>>,
}

#[cfg(target_os = "ios")]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportPhotoLibraryBatchArgs {
    session_id: String,
    offset: u32,
    limit: u32,
}

#[cfg(target_os = "ios")]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct EndPhotoLibraryScanArgs {
    session_id: String,
    cleanup: bool,
}

#[cfg(target_os = "ios")]
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("folder-import")
        .setup(|app, api| {
            let handle = api.register_ios_plugin(init_plugin_folder_import)?;
            app.manage(FolderImportPlugin(handle));
            Ok(())
        })
        .build()
}

#[cfg(not(target_os = "ios"))]
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("folder-import").build()
}

#[cfg(target_os = "ios")]
static PHOTO_EXPORT_CANCELLED: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

#[cfg(target_os = "ios")]
pub fn cancel_photo_library_export() {
    PHOTO_EXPORT_CANCELLED.store(true, std::sync::atomic::Ordering::SeqCst);
}

#[cfg(not(target_os = "ios"))]
pub fn cancel_photo_library_export() {}

#[cfg(not(target_os = "ios"))]
pub fn cancel_photo_library_export_plugin<R: Runtime>(_app: &AppHandle<R>) {}

#[cfg(target_os = "ios")]
pub fn cancel_photo_library_export_plugin<R: Runtime>(app: &AppHandle<R>) {
    PHOTO_EXPORT_CANCELLED.store(true, std::sync::atomic::Ordering::SeqCst);
    if let Some(plugin) = app.try_state::<FolderImportPlugin<R>>() {
        let _ = plugin.0.run_mobile_plugin::<()>("cancelPhotoLibraryExport", ());
    }
}

#[cfg(target_os = "ios")]
pub struct ExportedPhoto {
    pub path: String,
    pub asset_id: String,
}

#[cfg(target_os = "ios")]
pub async fn export_photo_library_with_progress<R, F>(
    app: AppHandle<R>,
    exclude_local_identifiers: Vec<String>,
    png_only: bool,
    mut on_progress: F,
) -> Result<Vec<ExportedPhoto>, String>
where
    R: Runtime,
    F: FnMut(usize, usize),
{
    use tauri::Manager;

    PHOTO_EXPORT_CANCELLED.store(false, std::sync::atomic::Ordering::SeqCst);
    let plugin = app.state::<FolderImportPlugin<R>>();
    let begin: BeginPhotoLibraryScanResponse = plugin
        .0
        .run_mobile_plugin(
            "beginPhotoLibraryScan",
            BeginPhotoLibraryScanArgs {
                exclude_local_identifiers,
                png_only,
                novelai_probe: png_only,
            },
        )
        .map_err(|e| e.to_string())?;

    let total = begin.total as usize;
    on_progress(0, total);

    if total == 0 {
        return Ok(Vec::new());
    }

    let session_id = begin
        .session_id
        .ok_or_else(|| "Photo library scan session missing".to_string())?;

    let mut all_items = Vec::new();
    let mut offset = 0u32;

    while (offset as usize) < total {
        if PHOTO_EXPORT_CANCELLED.load(std::sync::atomic::Ordering::SeqCst) {
            break;
        }

        let batch: ExportPhotoLibraryBatchResponse = plugin
            .0
            .run_mobile_plugin(
                "exportPhotoLibraryBatch",
                ExportPhotoLibraryBatchArgs {
                    session_id: session_id.clone(),
                    offset,
                    limit: PHOTO_LIBRARY_BATCH_SIZE,
                },
            )
            .map_err(|e| e.to_string())?;

        for item in batch.items.unwrap_or_default() {
            if !item.path.is_empty() {
                all_items.push(ExportedPhoto {
                    path: item.path,
                    asset_id: item.asset_id,
                });
            }
        }

        offset += PHOTO_LIBRARY_BATCH_SIZE;
        let current = std::cmp::min(offset as usize, total);
        on_progress(current, total);
    }

    let cleanup = PHOTO_EXPORT_CANCELLED.load(std::sync::atomic::Ordering::SeqCst);
    let _: () = plugin
        .0
        .run_mobile_plugin(
            "endPhotoLibraryScan",
            EndPhotoLibraryScanArgs {
                session_id,
                cleanup,
            },
        )
        .map_err(|e| e.to_string())?;

    if cleanup {
        all_items.clear();
    }

    Ok(all_items)
}

#[cfg(target_os = "ios")]
pub async fn export_photo_library<R: Runtime>(
    app: AppHandle<R>,
    exclude_local_identifiers: Vec<String>,
) -> Result<Vec<ExportedPhoto>, String> {
    export_photo_library_with_progress(app, exclude_local_identifiers, true, |_, _| {}).await
}

#[cfg(not(target_os = "ios"))]
pub async fn export_photo_library_with_progress<R, F>(
    _app: AppHandle<R>,
    _exclude_local_identifiers: Vec<String>,
    _png_only: bool,
    _on_progress: F,
) -> Result<Vec<ExportedPhoto>, String>
where
    R: Runtime,
    F: FnMut(usize, usize),
{
    Err("Photo library scan is only supported on iOS".to_string())
}

#[cfg(not(target_os = "ios"))]
pub struct ExportedPhoto {
    pub path: String,
    pub asset_id: String,
}

#[tauri::command]
pub async fn pick_import_folder<R: Runtime>(app: AppHandle<R>) -> Result<Option<String>, String> {
    #[cfg(target_os = "ios")]
    {
        let plugin = app.state::<FolderImportPlugin<R>>();
        let response: PickFolderResponse = plugin
            .0
            .run_mobile_plugin("pickFolder", ())
            .map_err(|e| e.to_string())?;
        Ok(response.path.filter(|path| !path.is_empty()))
    }

    #[cfg(not(target_os = "ios"))]
    {
        let _ = app;
        Err("Folder picker is only supported on iOS".to_string())
    }
}

#[tauri::command]
pub async fn pick_import_items<R: Runtime>(app: AppHandle<R>) -> Result<Vec<String>, String> {
    #[cfg(target_os = "ios")]
    {
        let plugin = app.state::<FolderImportPlugin<R>>();
        let response: PickItemsResponse = plugin
            .0
            .run_mobile_plugin("pickItems", ())
            .map_err(|e| e.to_string())?;
        Ok(response
            .paths
            .unwrap_or_default()
            .into_iter()
            .filter(|path| !path.is_empty())
            .collect())
    }

    #[cfg(not(target_os = "ios"))]
    {
        let _ = app;
        Err("Import picker is only supported on iOS".to_string())
    }
}

#[tauri::command]
pub async fn pick_import_photos<R: Runtime>(app: AppHandle<R>) -> Result<Vec<String>, String> {
    #[cfg(target_os = "ios")]
    {
        let plugin = app.state::<FolderImportPlugin<R>>();
        let response: PickItemsResponse = plugin
            .0
            .run_mobile_plugin("pickPhotos", ())
            .map_err(|e| e.to_string())?;
        Ok(response
            .paths
            .unwrap_or_default()
            .into_iter()
            .filter(|path| !path.is_empty())
            .collect())
    }

    #[cfg(not(target_os = "ios"))]
    {
        let _ = app;
        Err("Photo import picker is only supported on iOS".to_string())
    }
}

#[cfg(target_os = "ios")]
pub async fn share_file_ios<R: Runtime>(app: AppHandle<R>, path: String) -> Result<(), String> {
    use tauri::Manager;
    let plugin = app.state::<FolderImportPlugin<R>>();
    plugin
        .0
        .run_mobile_plugin("shareFile", serde_json::json!({ "path": path }))
        .map_err(|e| e.to_string())
}
