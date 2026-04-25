use tauri::{State, Manager};
use crate::db::*;

type DbState<'a> = State<'a, crate::db::DbState>;

fn db_err(e: rusqlite::Error) -> String {
    e.to_string()
}

#[tauri::command]
pub fn get_notes(state: DbState, parent_id: Option<String>) -> Result<Vec<Note>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::get_notes(&conn, parent_id.as_deref()).map_err(db_err)
}

#[tauri::command]
pub fn get_all_notes(state: DbState) -> Result<Vec<Note>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::get_all_notes(&conn).map_err(db_err)
}

#[tauri::command]
pub fn get_note_by_id(state: DbState, id: String) -> Result<Option<NoteWithRelations>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::get_note_by_id(&conn, &id).map_err(db_err)
}

#[tauri::command]
pub fn create_note(state: DbState, data: CreateNoteInput) -> Result<Option<NoteWithRelations>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::create_note(&conn, data).map_err(db_err)
}

#[tauri::command]
pub fn update_note(state: DbState, id: String, data: UpdateNoteInput) -> Result<Option<NoteWithRelations>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::update_note(&conn, &id, data).map_err(db_err)
}

#[tauri::command]
pub fn delete_note(state: DbState, id: String) -> Result<bool, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::delete_note(&conn, &id).map_err(db_err)
}

#[tauri::command]
pub fn promote_to_directory(state: DbState, id: String) -> Result<Option<NoteWithRelations>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::update_note(&conn, &id, UpdateNoteInput {
        is_directory: Some(true),
        body: None, parent_id: None, is_task: None, tags: None,
        icon: None, color: None, pinned: None, archived: None,
        completed: None, priority: None, sort_order: None,
    }).map_err(db_err)
}

#[tauri::command]
pub fn toggle_task_complete(state: DbState, id: String, completed: bool) -> Result<Option<NoteWithRelations>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::update_note(&conn, &id, UpdateNoteInput {
        completed: Some(completed),
        body: None, parent_id: None, is_directory: None, is_task: None,
        tags: None, icon: None, color: None, pinned: None, archived: None,
        priority: None, sort_order: None,
    }).map_err(db_err)
}

#[tauri::command]
pub fn get_directories(state: DbState) -> Result<Vec<DirectoryNode>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::get_directories(&conn).map_err(db_err)
}

#[tauri::command]
pub fn get_directory_tree(state: DbState) -> Result<Vec<DirectoryNode>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::get_directory_tree(&conn).map_err(db_err)
}

#[tauri::command]
pub fn get_tasks(state: DbState) -> Result<Vec<Note>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::get_tasks(&conn).map_err(db_err)
}

#[tauri::command]
pub fn search_notes(state: DbState, query: String) -> Result<Vec<Note>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::search_notes(&conn, &query).map_err(db_err)
}

#[tauri::command]
pub fn search_notes_for_link(state: DbState, query: String, exclude_id: String) -> Result<Vec<Note>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::search_notes_for_link(&conn, &query, &exclude_id).map_err(db_err)
}

#[tauri::command]
pub fn get_graph_data(state: DbState) -> Result<GraphData, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::get_graph_data(&conn).map_err(db_err)
}

#[tauri::command]
pub fn add_note_link(state: DbState, from_id: String, to_id: String) -> Result<bool, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::add_note_link(&conn, &from_id, &to_id).map_err(db_err)
}

#[tauri::command]
pub fn remove_note_link(state: DbState, from_id: String, to_id: String) -> Result<bool, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::remove_note_link(&conn, &from_id, &to_id).map_err(db_err)
}

#[tauri::command]
pub fn export_all_json(state: DbState) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let notes = crate::db::get_all_notes(&conn).map_err(db_err)?;
    serde_json::to_string_pretty(&notes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_data_path(app: tauri::AppHandle) -> Result<String, String> {
    app.path().app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_data_folder(app: tauri::AppHandle) -> Result<(), String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    open::that(path).map_err(|e| e.to_string())
}
