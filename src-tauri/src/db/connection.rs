use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use super::migrations;

pub struct DbState(pub Mutex<Connection>);

pub fn init_db(app: &AppHandle) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_data).map_err(|e| e.to_string())?;
    let db_path = db_path(&app_data);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    migrations::run_migrations(&conn)?;
    app.manage(DbState(Mutex::new(conn)));
    Ok(())
}

pub fn db_path(app_data: &PathBuf) -> PathBuf {
    app_data.join("database.db")
}

pub fn with_conn<F, T>(app: &AppHandle, f: F) -> Result<T, String>
where
    F: FnOnce(&Connection) -> Result<T, String>,
{
    let state = app.state::<DbState>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    f(&conn)
}

pub fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}
