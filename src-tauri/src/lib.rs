mod db;
mod commands;

use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
            let db_path = app_dir.join("second-brain.db");
            let conn = Connection::open(&db_path).expect("Failed to open database");
            db::init_db(&conn).expect("Failed to initialize database");
            app.manage(db::DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_notes,
            commands::get_all_notes,
            commands::get_note_by_id,
            commands::create_note,
            commands::update_note,
            commands::delete_note,
            commands::promote_to_directory,
            commands::toggle_task_complete,
            commands::get_directories,
            commands::get_directory_tree,
            commands::get_tasks,
            commands::search_notes,
            commands::search_notes_for_link,
            commands::get_graph_data,
            commands::add_note_link,
            commands::remove_note_link,
            commands::export_all_json,
            commands::get_data_path,
            commands::open_data_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
