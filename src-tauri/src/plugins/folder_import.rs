use serde::Deserialize;
use tauri::{
    plugin::{Builder, PluginHandle, TauriPlugin},
    AppHandle, Manager, Runtime,
};

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
