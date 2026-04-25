"use strict";
const electron = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const crypto = require("crypto");
function uuidv4() {
  return crypto.randomUUID();
}
let db;
function getDb() {
  if (!db) {
    const userDataPath = electron.app.getPath("userData");
    const dbPath = path.join(userDataPath, "second-brain.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}
function initSchema(db2) {
  db2.exec(`
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
  `);
  const count = db2.prepare("SELECT COUNT(*) as c FROM Note WHERE isDefaultModule = 1").get().c;
  if (count === 0) {
    seedDefaultDirectories(db2);
  }
}
const DEFAULT_DIRS = [
  { id: uuidv4(), body: "ひらめき", icon: "💡", color: "#F59E0B" },
  { id: uuidv4(), body: "感情ログ", icon: "❤️", color: "#EF4444" },
  { id: uuidv4(), body: "思考・問い", icon: "🧠", color: "#8B5CF6" },
  { id: uuidv4(), body: "タスク・現在", icon: "⏰", color: "#3B82F6" },
  { id: uuidv4(), body: "未来・計画", icon: "🌱", color: "#10B981" },
  { id: uuidv4(), body: "過去・記憶", icon: "📜", color: "#6B7280" },
  { id: uuidv4(), body: "学び・知識", icon: "🎓", color: "#0EA5E9" },
  { id: uuidv4(), body: "自己観察", icon: "🪞", color: "#EC4899" },
  { id: uuidv4(), body: "人間関係", icon: "👥", color: "#F97316" },
  { id: uuidv4(), body: "Inbox", icon: "📥", color: "#64748B" }
];
function seedDefaultDirectories(db2) {
  const insert = db2.prepare(`
    INSERT INTO Note (id, body, icon, color, isDirectory, isDefaultModule, sortOrder, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, 1, 1, ?, datetime('now'), datetime('now'))
  `);
  DEFAULT_DIRS.forEach((dir, i) => {
    insert.run(dir.id, dir.body, dir.icon, dir.color, i);
  });
}
function parseNote(row) {
  return {
    ...row,
    tags: JSON.parse(row.tags),
    isDirectory: Boolean(row.isDirectory),
    isDefaultModule: Boolean(row.isDefaultModule),
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    isTask: Boolean(row.isTask),
    completed: Boolean(row.completed)
  };
}
function dbGetNotes(parentId) {
  const db2 = getDb();
  let rows;
  if (parentId === void 0 || parentId === null) {
    rows = db2.prepare(
      `SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
         FROM Note n WHERE n.archived = 0 AND n.isDirectory = 0 AND n.parentId IS NULL
         ORDER BY n.pinned DESC, n.createdAt DESC`
    ).all();
  } else {
    rows = db2.prepare(
      `SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
         FROM Note n WHERE n.archived = 0 AND n.parentId = ?
         ORDER BY n.pinned DESC, n.createdAt DESC`
    ).all(parentId);
  }
  return rows.map(parseNote);
}
function dbGetAllNotes() {
  const db2 = getDb();
  const rows = db2.prepare(
    `SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
       FROM Note n WHERE n.archived = 0
       ORDER BY n.createdAt DESC`
  ).all();
  return rows.map(parseNote);
}
function dbGetNoteById(id) {
  const db2 = getDb();
  const row = db2.prepare(
    `SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
       FROM Note n WHERE n.id = ?`
  ).get(id);
  if (!row) return null;
  const note = parseNote(row);
  const children = db2.prepare(
    `SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
       FROM Note n WHERE n.parentId = ? AND n.archived = 0
       ORDER BY n.pinned DESC, n.createdAt DESC`
  ).all(id);
  const links = db2.prepare(
    `SELECT n.* FROM Note n
       JOIN NoteLink nl ON nl.toNoteId = n.id
       WHERE nl.fromNoteId = ?`
  ).all(id);
  const backlinks = db2.prepare(
    `SELECT n.* FROM Note n
       JOIN NoteLink nl ON nl.fromNoteId = n.id
       WHERE nl.toNoteId = ?`
  ).all(id);
  const attachments = db2.prepare("SELECT * FROM Attachment WHERE noteId = ? ORDER BY createdAt ASC").all(id);
  const parent = row.parentId ? db2.prepare("SELECT * FROM Note WHERE id = ?").get(row.parentId) : null;
  return {
    ...note,
    children: children.map(parseNote),
    links: links.map(parseNote),
    backlinks: backlinks.map(parseNote),
    attachments,
    parent: parent ? parseNote(parent) : null
  };
}
function dbGetDirectories() {
  const db2 = getDb();
  const rows = db2.prepare(
    `SELECT n.*,
        (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id AND c.isDirectory = 0 AND c.archived = 0) as noteCount,
        (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id AND c.isDirectory = 1 AND c.archived = 0) as dirCount
       FROM Note n
       WHERE n.isDirectory = 1 AND n.archived = 0
       ORDER BY n.isDefaultModule DESC, n.sortOrder ASC, n.createdAt ASC`
  ).all();
  return rows.map((r) => ({
    ...parseNote(r),
    noteCount: r.noteCount,
    dirCount: r.dirCount
  }));
}
function dbGetDirectoryTree() {
  const allDirs = dbGetDirectories();
  function buildTree(parentId) {
    return allDirs.filter((d) => d.parentId === parentId).map((d) => ({ ...d, children: buildTree(d.id) }));
  }
  return buildTree(null);
}
function dbGetTasks() {
  const db2 = getDb();
  const rows = db2.prepare(
    `SELECT * FROM Note WHERE isTask = 1 AND archived = 0 ORDER BY completed ASC, createdAt DESC`
  ).all();
  return rows.map(parseNote);
}
function dbSearchNotes(query) {
  const db2 = getDb();
  const q = `%${query}%`;
  const rows = db2.prepare(
    `SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
       FROM Note n
       WHERE n.archived = 0
         AND (n.body LIKE ? OR n.tags LIKE ?)
       ORDER BY n.createdAt DESC
       LIMIT 100`
  ).all(q, q);
  return rows.map(parseNote);
}
function dbSearchNotesForLink(query, excludeId) {
  const db2 = getDb();
  const q = `%${query}%`;
  const rows = db2.prepare(
    `SELECT * FROM Note WHERE archived = 0 AND id != ? AND (body LIKE ? OR tags LIKE ?)
       ORDER BY createdAt DESC LIMIT 20`
  ).all(excludeId, q, q);
  return rows.map(parseNote);
}
function dbGetGraphData() {
  const db2 = getDb();
  const notes = db2.prepare("SELECT * FROM Note WHERE archived = 0").all();
  const links = db2.prepare("SELECT * FROM NoteLink").all();
  const nodes = notes.map((n) => ({
    id: n.id,
    body: n.body,
    icon: n.icon,
    color: n.color,
    isDirectory: Boolean(n.isDirectory),
    parentId: n.parentId,
    tags: JSON.parse(n.tags)
  }));
  const edges = [
    ...notes.filter((n) => n.parentId).map((n) => ({ fromId: n.parentId, toId: n.id, type: "parent" })),
    ...links.map((l) => ({ fromId: l.fromNoteId, toId: l.toNoteId, type: "link" }))
  ];
  return { nodes, edges };
}
function dbCreateNote(data) {
  const db2 = getDb();
  const id = uuidv4();
  db2.prepare(
    `INSERT INTO Note (id, body, parentId, isDirectory, isTask, tags, icon, color, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).run(
    id,
    data.body,
    data.parentId ?? null,
    data.isDirectory ? 1 : 0,
    data.isTask ? 1 : 0,
    JSON.stringify(data.tags ?? []),
    data.icon ?? null,
    data.color ?? null
  );
  return dbGetNoteById(id);
}
function dbUpdateNote(id, data) {
  const db2 = getDb();
  const fields = [];
  const values = [];
  if (data.body !== void 0) {
    fields.push("body = ?");
    values.push(data.body);
  }
  if (data.parentId !== void 0) {
    fields.push("parentId = ?");
    values.push(data.parentId);
  }
  if (data.isDirectory !== void 0) {
    fields.push("isDirectory = ?");
    values.push(data.isDirectory ? 1 : 0);
  }
  if (data.isTask !== void 0) {
    fields.push("isTask = ?");
    values.push(data.isTask ? 1 : 0);
  }
  if (data.tags !== void 0) {
    fields.push("tags = ?");
    values.push(JSON.stringify(data.tags));
  }
  if (data.icon !== void 0) {
    fields.push("icon = ?");
    values.push(data.icon);
  }
  if (data.color !== void 0) {
    fields.push("color = ?");
    values.push(data.color);
  }
  if (data.pinned !== void 0) {
    fields.push("pinned = ?");
    values.push(data.pinned ? 1 : 0);
  }
  if (data.archived !== void 0) {
    fields.push("archived = ?");
    values.push(data.archived ? 1 : 0);
  }
  if (data.completed !== void 0) {
    fields.push("completed = ?");
    values.push(data.completed ? 1 : 0);
  }
  if (data.sortOrder !== void 0) {
    fields.push("sortOrder = ?");
    values.push(data.sortOrder);
  }
  if (fields.length === 0) return dbGetNoteById(id);
  fields.push("updatedAt = datetime('now')");
  values.push(id);
  db2.prepare(`UPDATE Note SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return dbGetNoteById(id);
}
function dbDeleteNote(id) {
  const db2 = getDb();
  db2.prepare("DELETE FROM Note WHERE id = ?").run(id);
  return true;
}
function dbPromoteToDirectory(id) {
  return dbUpdateNote(id, { isDirectory: true });
}
function dbToggleTaskComplete(id, completed) {
  return dbUpdateNote(id, { completed });
}
function dbAddNoteLink(fromId, toId) {
  const db2 = getDb();
  db2.prepare(
    "INSERT OR IGNORE INTO NoteLink (fromNoteId, toNoteId) VALUES (?, ?)"
  ).run(fromId, toId);
  db2.prepare(
    "INSERT OR IGNORE INTO NoteLink (fromNoteId, toNoteId) VALUES (?, ?)"
  ).run(toId, fromId);
  return true;
}
function dbRemoveNoteLink(fromId, toId) {
  const db2 = getDb();
  db2.prepare("DELETE FROM NoteLink WHERE fromNoteId = ? AND toNoteId = ?").run(fromId, toId);
  db2.prepare("DELETE FROM NoteLink WHERE fromNoteId = ? AND toNoteId = ?").run(toId, fromId);
  return true;
}
const isDev = process.env.NODE_ENV === "development" || !electron.app.isPackaged;
function createWindow() {
  const win = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0f0f0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}
electron.app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
function registerIpcHandlers() {
  electron.ipcMain.handle(
    "db:getNotes",
    (_e, parentId) => dbGetNotes(parentId)
  );
  electron.ipcMain.handle("db:getAllNotes", () => dbGetAllNotes());
  electron.ipcMain.handle("db:getNoteById", (_e, id) => dbGetNoteById(id));
  electron.ipcMain.handle(
    "db:createNote",
    (_e, data) => dbCreateNote(data)
  );
  electron.ipcMain.handle(
    "db:updateNote",
    (_e, id, data) => dbUpdateNote(id, data)
  );
  electron.ipcMain.handle("db:deleteNote", (_e, id) => dbDeleteNote(id));
  electron.ipcMain.handle(
    "db:promoteToDirectory",
    (_e, id) => dbPromoteToDirectory(id)
  );
  electron.ipcMain.handle(
    "db:toggleTaskComplete",
    (_e, id, completed) => dbToggleTaskComplete(id, completed)
  );
  electron.ipcMain.handle("db:getDirectories", () => dbGetDirectories());
  electron.ipcMain.handle("db:getDirectoryTree", () => dbGetDirectoryTree());
  electron.ipcMain.handle("db:getTasks", () => dbGetTasks());
  electron.ipcMain.handle(
    "db:searchNotes",
    (_e, query) => dbSearchNotes(query)
  );
  electron.ipcMain.handle(
    "db:searchNotesForLink",
    (_e, query, excludeId) => dbSearchNotesForLink(query, excludeId)
  );
  electron.ipcMain.handle("db:getGraphData", () => dbGetGraphData());
  electron.ipcMain.handle(
    "db:addNoteLink",
    (_e, fromId, toId) => dbAddNoteLink(fromId, toId)
  );
  electron.ipcMain.handle(
    "db:removeNoteLink",
    (_e, fromId, toId) => dbRemoveNoteLink(fromId, toId)
  );
  electron.ipcMain.handle("db:exportAllJson", () => {
    const db2 = getDb();
    const notes = db2.prepare("SELECT * FROM Note").all();
    const links = db2.prepare("SELECT * FROM NoteLink").all();
    const attachments = db2.prepare("SELECT * FROM Attachment").all();
    return JSON.stringify({ notes, links, attachments }, null, 2);
  });
  electron.ipcMain.handle("db:getDataPath", () => {
    return electron.app.getPath("userData");
  });
  electron.ipcMain.handle("shell:openDataFolder", () => {
    electron.shell.openPath(electron.app.getPath("userData"));
  });
}
