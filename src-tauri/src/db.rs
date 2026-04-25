use rusqlite::{Connection, Result, params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use uuid::Uuid;

pub struct DbState(pub Mutex<Connection>);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: String,
    pub body: String,
    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,
    #[serde(rename = "isDirectory")]
    pub is_directory: bool,
    #[serde(rename = "isDefaultModule")]
    pub is_default_module: bool,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub tags: Vec<String>,
    pub pinned: bool,
    pub archived: bool,
    #[serde(rename = "isTask")]
    pub is_task: bool,
    pub completed: bool,
    pub priority: i64,
    #[serde(rename = "sortOrder")]
    pub sort_order: i64,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "childCount")]
    pub child_count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteWithRelations {
    #[serde(flatten)]
    pub note: Note,
    pub children: Vec<Note>,
    pub links: Vec<Note>,
    pub backlinks: Vec<Note>,
    pub attachments: Vec<Attachment>,
    pub parent: Option<Box<Note>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Attachment {
    pub id: String,
    #[serde(rename = "noteId")]
    pub note_id: String,
    #[serde(rename = "type")]
    pub attachment_type: String,
    pub url: Option<String>,
    #[serde(rename = "ogpTitle")]
    pub ogp_title: Option<String>,
    #[serde(rename = "ogpDesc")]
    pub ogp_desc: Option<String>,
    #[serde(rename = "ogpImage")]
    pub ogp_image: Option<String>,
    #[serde(rename = "mimeType")]
    pub mime_type: Option<String>,
    #[serde(rename = "localPath")]
    pub local_path: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DirectoryNode {
    #[serde(flatten)]
    pub note: Note,
    #[serde(rename = "noteCount")]
    pub note_count: i64,
    #[serde(rename = "dirCount")]
    pub dir_count: i64,
    pub children: Vec<DirectoryNode>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphNode {
    pub id: String,
    pub body: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    #[serde(rename = "isDirectory")]
    pub is_directory: bool,
    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphEdge {
    #[serde(rename = "fromId")]
    pub from_id: String,
    #[serde(rename = "toId")]
    pub to_id: String,
    #[serde(rename = "type")]
    pub edge_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

fn parse_tags(tags_json: &str) -> Vec<String> {
    serde_json::from_str(tags_json).unwrap_or_default()
}

fn row_to_note(row: &rusqlite::Row) -> Result<Note> {
    let tags_str: String = row.get("tags")?;
    let child_count: Option<i64> = row.get("childCount").ok();
    Ok(Note {
        id: row.get("id")?,
        body: row.get("body")?,
        parent_id: row.get("parentId")?,
        is_directory: row.get::<_, i64>("isDirectory")? != 0,
        is_default_module: row.get::<_, i64>("isDefaultModule")? != 0,
        icon: row.get("icon")?,
        color: row.get("color")?,
        tags: parse_tags(&tags_str),
        pinned: row.get::<_, i64>("pinned")? != 0,
        archived: row.get::<_, i64>("archived")? != 0,
        is_task: row.get::<_, i64>("isTask")? != 0,
        completed: row.get::<_, i64>("completed")? != 0,
        priority: row.get::<_, i64>("priority").unwrap_or(0),
        sort_order: row.get("sortOrder")?,
        created_at: row.get("createdAt")?,
        updated_at: row.get("updatedAt")?,
        child_count,
    })
}

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch("
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS Note (
            id TEXT PRIMARY KEY,
            body TEXT NOT NULL DEFAULT '',
            parentId TEXT REFERENCES Note(id) ON DELETE SET NULL,
            isDirectory INTEGER NOT NULL DEFAULT 0,
            isDefaultModule INTEGER NOT NULL DEFAULT 0,
            icon TEXT,
            color TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            pinned INTEGER NOT NULL DEFAULT 0,
            archived INTEGER NOT NULL DEFAULT 0,
            isTask INTEGER NOT NULL DEFAULT 0,
            completed INTEGER NOT NULL DEFAULT 0,
            priority INTEGER NOT NULL DEFAULT 0,
            sortOrder INTEGER NOT NULL DEFAULT 0,
            createdAt TEXT NOT NULL DEFAULT (datetime('now')),
            updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS NoteLink (
            fromNoteId TEXT NOT NULL REFERENCES Note(id) ON DELETE CASCADE,
            toNoteId TEXT NOT NULL REFERENCES Note(id) ON DELETE CASCADE,
            PRIMARY KEY (fromNoteId, toNoteId)
        );

        CREATE TABLE IF NOT EXISTS Attachment (
            id TEXT PRIMARY KEY,
            noteId TEXT NOT NULL REFERENCES Note(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            url TEXT,
            ogpTitle TEXT,
            ogpDesc TEXT,
            ogpImage TEXT,
            mimeType TEXT,
            localPath TEXT,
            createdAt TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_note_parentId ON Note(parentId);
        CREATE INDEX IF NOT EXISTS idx_note_archived ON Note(archived);
        CREATE INDEX IF NOT EXISTS idx_note_isTask ON Note(isTask);
        CREATE INDEX IF NOT EXISTS idx_attachment_noteId ON Attachment(noteId);
    ")?;

    // マイグレーション: priority列がなければ追加
    let _ = conn.execute("ALTER TABLE Note ADD COLUMN priority INTEGER NOT NULL DEFAULT 0", []);

    // デフォルト脳機能ディレクトリのシード
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM Note WHERE isDefaultModule = 1",
        [],
        |row| row.get(0),
    )?;

    if count == 0 {
        seed_default_directories(conn)?;
    }

    Ok(())
}

fn seed_default_directories(conn: &Connection) -> Result<()> {
    let dirs = vec![
        ("Inbox", "📥", "#64748B"),
        ("Ideas", "💡", "#F59E0B"),
        ("Emotions", "❤️", "#EF4444"),
        ("Thoughts", "🧠", "#8B5CF6"),
        ("Today", "⏰", "#3B82F6"),
        ("Plans", "🌱", "#10B981"),
        ("Memories", "📜", "#6B7280"),
        ("Knowledge", "🎓", "#0EA5E9"),
        ("Self", "🪞", "#EC4899"),
        ("People", "👥", "#F97316"),
    ];

    for (i, (body, icon, color)) in dirs.iter().enumerate() {
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO Note (id, body, icon, color, isDirectory, isDefaultModule, sortOrder, createdAt, updatedAt)
             VALUES (?1, ?2, ?3, ?4, 1, 1, ?5, datetime('now'), datetime('now'))",
            params![id, body, icon, color, i as i64],
        )?;
    }
    Ok(())
}

// ────────────────────────────────────────────────
// Read operations
// ────────────────────────────────────────────────

pub fn get_notes(conn: &Connection, parent_id: Option<&str>) -> Result<Vec<Note>> {
    let sql = match parent_id {
        None => "SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
                 FROM Note n WHERE n.archived = 0 AND n.isDirectory = 0 AND n.parentId IS NULL
                 ORDER BY n.pinned DESC, n.createdAt DESC".to_string(),
        Some(pid) => format!(
            "SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
             FROM Note n WHERE n.archived = 0 AND n.parentId = '{}'
             ORDER BY n.pinned DESC, n.createdAt DESC", pid
        ),
    };

    let mut stmt = conn.prepare(&sql)?;
    let notes = stmt.query_map([], row_to_note)?
        .collect::<Result<Vec<_>>>()?;
    Ok(notes)
}

pub fn get_all_notes(conn: &Connection) -> Result<Vec<Note>> {
    let mut stmt = conn.prepare(
        "SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
         FROM Note n WHERE n.archived = 0
         ORDER BY n.createdAt DESC"
    )?;
    let notes = stmt.query_map([], row_to_note)?.collect::<Result<Vec<_>>>()?;
    Ok(notes)
}

pub fn get_note_by_id(conn: &Connection, id: &str) -> Result<Option<NoteWithRelations>> {
    let note = conn.query_row(
        "SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
         FROM Note n WHERE n.id = ?1",
        params![id],
        row_to_note,
    ).optional()?;

    let note = match note {
        None => return Ok(None),
        Some(n) => n,
    };

    let children: Vec<Note> = {
        let mut stmt = conn.prepare(
            "SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
             FROM Note n WHERE n.parentId = ?1 AND n.archived = 0
             ORDER BY n.pinned DESC, n.createdAt DESC"
        )?;
        let v = stmt.query_map(params![id], row_to_note)?.collect::<Result<Vec<_>>>()?;
        v
    };

    let links: Vec<Note> = {
        let mut stmt = conn.prepare(
            "SELECT n.*, 0 as childCount FROM Note n
             JOIN NoteLink nl ON nl.toNoteId = n.id
             WHERE nl.fromNoteId = ?1"
        )?;
        let v = stmt.query_map(params![id], row_to_note)?.collect::<Result<Vec<_>>>()?;
        v
    };

    let backlinks: Vec<Note> = {
        let mut stmt = conn.prepare(
            "SELECT n.*, 0 as childCount FROM Note n
             JOIN NoteLink nl ON nl.fromNoteId = n.id
             WHERE nl.toNoteId = ?1"
        )?;
        let v = stmt.query_map(params![id], row_to_note)?.collect::<Result<Vec<_>>>()?;
        v
    };

    let parent: Option<Box<Note>> = match &note.parent_id {
        None => None,
        Some(pid) => {
            conn.query_row(
                "SELECT *, 0 as childCount FROM Note WHERE id = ?1",
                params![pid],
                row_to_note,
            ).optional()?.map(Box::new)
        }
    };

    Ok(Some(NoteWithRelations {
        note,
        children,
        links,
        backlinks,
        attachments: vec![],
        parent,
    }))
}

pub fn get_directories(conn: &Connection) -> Result<Vec<DirectoryNode>> {
    let mut stmt = conn.prepare(
        "SELECT n.*,
            (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id AND c.isDirectory = 0 AND c.archived = 0) as noteCount,
            (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id AND c.isDirectory = 1 AND c.archived = 0) as dirCount,
            0 as childCount
         FROM Note n
         WHERE n.isDirectory = 1 AND n.archived = 0
         ORDER BY n.isDefaultModule DESC, n.sortOrder ASC, n.createdAt ASC"
    )?;

    let rows: Vec<(Note, i64, i64)> = stmt.query_map([], |row| {
        let note = row_to_note(row)?;
        let note_count: i64 = row.get("noteCount")?;
        let dir_count: i64 = row.get("dirCount")?;
        Ok((note, note_count, dir_count))
    })?.collect::<Result<Vec<_>>>()?;

    Ok(rows.into_iter().map(|(note, note_count, dir_count)| DirectoryNode {
        note,
        note_count,
        dir_count,
        children: vec![],
    }).collect())
}

pub fn get_directory_tree(conn: &Connection) -> Result<Vec<DirectoryNode>> {
    let all_dirs = get_directories(conn)?;
    fn build_tree(all: &[DirectoryNode], parent_id: Option<&str>) -> Vec<DirectoryNode> {
        all.iter()
            .filter(|d| d.note.parent_id.as_deref() == parent_id)
            .map(|d| {
                let children = build_tree(all, Some(&d.note.id));
                DirectoryNode {
                    note: d.note.clone(),
                    note_count: d.note_count,
                    dir_count: d.dir_count,
                    children,
                }
            })
            .collect()
    }
    Ok(build_tree(&all_dirs, None))
}

pub fn get_tasks(conn: &Connection) -> Result<Vec<Note>> {
    let mut stmt = conn.prepare(
        "SELECT *, 0 as childCount FROM Note WHERE isTask = 1 AND archived = 0 ORDER BY completed ASC, createdAt DESC"
    )?;
    let notes = stmt.query_map([], row_to_note)?.collect::<Result<Vec<_>>>()?;
    Ok(notes)
}

pub fn search_notes(conn: &Connection, query: &str) -> Result<Vec<Note>> {
    let q = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
         FROM Note n
         WHERE n.archived = 0 AND (n.body LIKE ?1 OR n.tags LIKE ?2)
         ORDER BY n.createdAt DESC LIMIT 100"
    )?;
    let notes = stmt.query_map(params![&q, &q], row_to_note)?.collect::<Result<Vec<_>>>()?;
    Ok(notes)
}

pub fn search_notes_for_link(conn: &Connection, query: &str, exclude_id: &str) -> Result<Vec<Note>> {
    let q = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT *, 0 as childCount FROM Note WHERE archived = 0 AND id != ?1 AND (body LIKE ?2 OR tags LIKE ?3)
         ORDER BY createdAt DESC LIMIT 20"
    )?;
    let notes = stmt.query_map(params![exclude_id, &q, &q], row_to_note)?.collect::<Result<Vec<_>>>()?;
    Ok(notes)
}

pub fn get_graph_data(conn: &Connection) -> Result<GraphData> {
    let mut note_stmt = conn.prepare("SELECT *, 0 as childCount FROM Note WHERE archived = 0")?;
    let notes: Vec<Note> = note_stmt.query_map([], row_to_note)?.collect::<Result<Vec<_>>>()?;

    let mut link_stmt = conn.prepare("SELECT * FROM NoteLink")?;
    let links: Vec<(String, String)> = link_stmt.query_map([], |row| {
        Ok((row.get::<_, String>("fromNoteId")?, row.get::<_, String>("toNoteId")?))
    })?.collect::<Result<Vec<_>>>()?;

    let nodes: Vec<GraphNode> = notes.iter().map(|n| GraphNode {
        id: n.id.clone(),
        body: n.body.clone(),
        icon: n.icon.clone(),
        color: n.color.clone(),
        is_directory: n.is_directory,
        parent_id: n.parent_id.clone(),
        tags: n.tags.clone(),
    }).collect();

    let mut edges: Vec<GraphEdge> = notes.iter()
        .filter(|n| n.parent_id.is_some())
        .map(|n| GraphEdge {
            from_id: n.parent_id.clone().unwrap(),
            to_id: n.id.clone(),
            edge_type: "parent".to_string(),
        })
        .collect();

    for (from, to) in links {
        edges.push(GraphEdge {
            from_id: from,
            to_id: to,
            edge_type: "link".to_string(),
        });
    }

    Ok(GraphData { nodes, edges })
}

// ────────────────────────────────────────────────
// Write operations
// ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateNoteInput {
    pub body: String,
    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,
    #[serde(rename = "isDirectory")]
    pub is_directory: Option<bool>,
    #[serde(rename = "isTask")]
    pub is_task: Option<bool>,
    pub tags: Option<Vec<String>>,
    pub icon: Option<String>,
    pub color: Option<String>,
}

pub fn create_note(conn: &Connection, input: CreateNoteInput) -> Result<Option<NoteWithRelations>> {
    let id = Uuid::new_v4().to_string();
    let tags_json = serde_json::to_string(&input.tags.unwrap_or_default()).unwrap();
    conn.execute(
        "INSERT INTO Note (id, body, parentId, isDirectory, isTask, tags, icon, color, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'), datetime('now'))",
        params![
            id,
            input.body,
            input.parent_id,
            input.is_directory.unwrap_or(false) as i64,
            input.is_task.unwrap_or(false) as i64,
            tags_json,
            input.icon,
            input.color,
        ],
    )?;
    get_note_by_id(conn, &id)
}

#[derive(Debug, Deserialize)]
pub struct UpdateNoteInput {
    pub body: Option<String>,
    #[serde(rename = "parentId")]
    pub parent_id: Option<Option<String>>,
    #[serde(rename = "isDirectory")]
    pub is_directory: Option<bool>,
    #[serde(rename = "isTask")]
    pub is_task: Option<bool>,
    pub tags: Option<Vec<String>>,
    pub icon: Option<Option<String>>,
    pub color: Option<Option<String>>,
    pub pinned: Option<bool>,
    pub archived: Option<bool>,
    pub completed: Option<bool>,
    pub priority: Option<i64>,
    #[serde(rename = "sortOrder")]
    pub sort_order: Option<i64>,
}

pub fn update_note(conn: &Connection, id: &str, input: UpdateNoteInput) -> Result<Option<NoteWithRelations>> {
    if let Some(body) = &input.body {
        conn.execute("UPDATE Note SET body = ?1, updatedAt = datetime('now') WHERE id = ?2", params![body, id])?;
    }
    if let Some(parent_id) = &input.parent_id {
        conn.execute("UPDATE Note SET parentId = ?1, updatedAt = datetime('now') WHERE id = ?2", params![parent_id, id])?;
    }
    if let Some(is_dir) = input.is_directory {
        conn.execute("UPDATE Note SET isDirectory = ?1, updatedAt = datetime('now') WHERE id = ?2", params![is_dir as i64, id])?;
    }
    if let Some(is_task) = input.is_task {
        conn.execute("UPDATE Note SET isTask = ?1, updatedAt = datetime('now') WHERE id = ?2", params![is_task as i64, id])?;
    }
    if let Some(tags) = &input.tags {
        let tags_json = serde_json::to_string(tags).unwrap();
        conn.execute("UPDATE Note SET tags = ?1, updatedAt = datetime('now') WHERE id = ?2", params![tags_json, id])?;
    }
    if let Some(icon) = &input.icon {
        conn.execute("UPDATE Note SET icon = ?1, updatedAt = datetime('now') WHERE id = ?2", params![icon, id])?;
    }
    if let Some(color) = &input.color {
        conn.execute("UPDATE Note SET color = ?1, updatedAt = datetime('now') WHERE id = ?2", params![color, id])?;
    }
    if let Some(pinned) = input.pinned {
        conn.execute("UPDATE Note SET pinned = ?1, updatedAt = datetime('now') WHERE id = ?2", params![pinned as i64, id])?;
    }
    if let Some(archived) = input.archived {
        conn.execute("UPDATE Note SET archived = ?1, updatedAt = datetime('now') WHERE id = ?2", params![archived as i64, id])?;
    }
    if let Some(completed) = input.completed {
        conn.execute("UPDATE Note SET completed = ?1, updatedAt = datetime('now') WHERE id = ?2", params![completed as i64, id])?;
    }
    if let Some(priority) = input.priority {
        conn.execute("UPDATE Note SET priority = ?1, updatedAt = datetime('now') WHERE id = ?2", params![priority, id])?;
    }
    if let Some(sort_order) = input.sort_order {
        conn.execute("UPDATE Note SET sortOrder = ?1, updatedAt = datetime('now') WHERE id = ?2", params![sort_order, id])?;
    }
    get_note_by_id(conn, id)
}

pub fn delete_note(conn: &Connection, id: &str) -> Result<bool> {
    conn.execute("DELETE FROM Note WHERE id = ?1", params![id])?;
    Ok(true)
}

pub fn add_note_link(conn: &Connection, from_id: &str, to_id: &str) -> Result<bool> {
    conn.execute(
        "INSERT OR IGNORE INTO NoteLink (fromNoteId, toNoteId) VALUES (?1, ?2)",
        params![from_id, to_id],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO NoteLink (fromNoteId, toNoteId) VALUES (?1, ?2)",
        params![to_id, from_id],
    )?;
    Ok(true)
}

pub fn remove_note_link(conn: &Connection, from_id: &str, to_id: &str) -> Result<bool> {
    conn.execute("DELETE FROM NoteLink WHERE fromNoteId = ?1 AND toNoteId = ?2", params![from_id, to_id])?;
    conn.execute("DELETE FROM NoteLink WHERE fromNoteId = ?1 AND toNoteId = ?2", params![to_id, from_id])?;
    Ok(true)
}
