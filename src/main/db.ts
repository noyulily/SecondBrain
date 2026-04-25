import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";
import { randomUUID } from "crypto";

function uuidv4(): string {
  return randomUUID();
}

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const userDataPath = app.getPath("userData");
    const dbPath = path.join(userDataPath, "second-brain.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
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

  // デフォルト脳機能ディレクトリが未作成なら投入
  const count = (db.prepare("SELECT COUNT(*) as c FROM Note WHERE isDefaultModule = 1").get() as { c: number }).c;
  if (count === 0) {
    seedDefaultDirectories(db);
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
  { id: uuidv4(), body: "Inbox", icon: "📥", color: "#64748B" },
];

function seedDefaultDirectories(db: Database.Database) {
  const insert = db.prepare(`
    INSERT INTO Note (id, body, icon, color, isDirectory, isDefaultModule, sortOrder, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, 1, 1, ?, datetime('now'), datetime('now'))
  `);
  DEFAULT_DIRS.forEach((dir, i) => {
    insert.run(dir.id, dir.body, dir.icon, dir.color, i);
  });
}

// ----------------------------------------------------------------
// Note操作
// ----------------------------------------------------------------

export interface NoteRow {
  id: string;
  body: string;
  parentId: string | null;
  isDirectory: number;
  isDefaultModule: number;
  icon: string | null;
  color: string | null;
  tags: string;
  pinned: number;
  archived: number;
  isTask: number;
  completed: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentRow {
  id: string;
  noteId: string;
  type: string;
  url: string | null;
  ogpTitle: string | null;
  ogpDesc: string | null;
  ogpImage: string | null;
  mimeType: string | null;
  localPath: string | null;
  createdAt: string;
}

function parseNote(row: NoteRow) {
  return {
    ...row,
    tags: JSON.parse(row.tags) as string[],
    isDirectory: Boolean(row.isDirectory),
    isDefaultModule: Boolean(row.isDefaultModule),
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    isTask: Boolean(row.isTask),
    completed: Boolean(row.completed),
  };
}

export function dbGetNotes(parentId?: string | null) {
  const db = getDb();
  let rows: NoteRow[];
  if (parentId === undefined || parentId === null) {
    rows = db
      .prepare(
        `SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
         FROM Note n WHERE n.archived = 0 AND n.isDirectory = 0 AND n.parentId IS NULL
         ORDER BY n.pinned DESC, n.createdAt DESC`
      )
      .all() as NoteRow[];
  } else {
    rows = db
      .prepare(
        `SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
         FROM Note n WHERE n.archived = 0 AND n.parentId = ?
         ORDER BY n.pinned DESC, n.createdAt DESC`
      )
      .all(parentId) as NoteRow[];
  }
  return rows.map(parseNote);
}

export function dbGetAllNotes() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
       FROM Note n WHERE n.archived = 0
       ORDER BY n.createdAt DESC`
    )
    .all() as NoteRow[];
  return rows.map(parseNote);
}

export function dbGetNoteById(id: string) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
       FROM Note n WHERE n.id = ?`
    )
    .get(id) as NoteRow | undefined;
  if (!row) return null;

  const note = parseNote(row);

  const children = db
    .prepare(
      `SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
       FROM Note n WHERE n.parentId = ? AND n.archived = 0
       ORDER BY n.pinned DESC, n.createdAt DESC`
    )
    .all(id) as NoteRow[];

  const links = db
    .prepare(
      `SELECT n.* FROM Note n
       JOIN NoteLink nl ON nl.toNoteId = n.id
       WHERE nl.fromNoteId = ?`
    )
    .all(id) as NoteRow[];

  const backlinks = db
    .prepare(
      `SELECT n.* FROM Note n
       JOIN NoteLink nl ON nl.fromNoteId = n.id
       WHERE nl.toNoteId = ?`
    )
    .all(id) as NoteRow[];

  const attachments = db
    .prepare("SELECT * FROM Attachment WHERE noteId = ? ORDER BY createdAt ASC")
    .all(id) as AttachmentRow[];

  const parent = row.parentId
    ? (db.prepare("SELECT * FROM Note WHERE id = ?").get(row.parentId) as NoteRow | undefined)
    : null;

  return {
    ...note,
    children: children.map(parseNote),
    links: links.map(parseNote),
    backlinks: backlinks.map(parseNote),
    attachments,
    parent: parent ? parseNote(parent) : null,
  };
}

export function dbGetDirectories() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT n.*,
        (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id AND c.isDirectory = 0 AND c.archived = 0) as noteCount,
        (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id AND c.isDirectory = 1 AND c.archived = 0) as dirCount
       FROM Note n
       WHERE n.isDirectory = 1 AND n.archived = 0
       ORDER BY n.isDefaultModule DESC, n.sortOrder ASC, n.createdAt ASC`
    )
    .all() as (NoteRow & { noteCount: number; dirCount: number })[];

  return rows.map((r) => ({
    ...parseNote(r),
    noteCount: r.noteCount,
    dirCount: r.dirCount,
  }));
}

export function dbGetDirectoryTree() {
  const allDirs = dbGetDirectories();
  function buildTree(parentId: string | null): typeof allDirs {
    return allDirs
      .filter((d) => d.parentId === parentId)
      .map((d) => ({ ...d, children: buildTree(d.id) }));
  }
  return buildTree(null);
}

export function dbGetTasks() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM Note WHERE isTask = 1 AND archived = 0 ORDER BY completed ASC, createdAt DESC`
    )
    .all() as NoteRow[];
  return rows.map(parseNote);
}

export function dbSearchNotes(query: string) {
  const db = getDb();
  const q = `%${query}%`;
  const rows = db
    .prepare(
      `SELECT n.*, (SELECT COUNT(*) FROM Note c WHERE c.parentId = n.id) as childCount
       FROM Note n
       WHERE n.archived = 0
         AND (n.body LIKE ? OR n.tags LIKE ?)
       ORDER BY n.createdAt DESC
       LIMIT 100`
    )
    .all(q, q) as NoteRow[];
  return rows.map(parseNote);
}

export function dbSearchNotesForLink(query: string, excludeId: string) {
  const db = getDb();
  const q = `%${query}%`;
  const rows = db
    .prepare(
      `SELECT * FROM Note WHERE archived = 0 AND id != ? AND (body LIKE ? OR tags LIKE ?)
       ORDER BY createdAt DESC LIMIT 20`
    )
    .all(excludeId, q, q) as NoteRow[];
  return rows.map(parseNote);
}

export function dbGetGraphData() {
  const db = getDb();
  const notes = db.prepare("SELECT * FROM Note WHERE archived = 0").all() as NoteRow[];
  const links = db.prepare("SELECT * FROM NoteLink").all() as { fromNoteId: string; toNoteId: string }[];

  const nodes = notes.map((n) => ({
    id: n.id,
    body: n.body,
    icon: n.icon,
    color: n.color,
    isDirectory: Boolean(n.isDirectory),
    parentId: n.parentId,
    tags: JSON.parse(n.tags) as string[],
  }));

  const edges = [
    ...notes
      .filter((n) => n.parentId)
      .map((n) => ({ fromId: n.parentId!, toId: n.id, type: "parent" as const })),
    ...links.map((l) => ({ fromId: l.fromNoteId, toId: l.toNoteId, type: "link" as const })),
  ];

  return { nodes, edges };
}

export function dbCreateNote(data: {
  body: string;
  parentId?: string | null;
  isDirectory?: boolean;
  isTask?: boolean;
  tags?: string[];
  icon?: string;
  color?: string;
}) {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
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

export function dbUpdateNote(
  id: string,
  data: Partial<{
    body: string;
    parentId: string | null;
    isDirectory: boolean;
    isTask: boolean;
    tags: string[];
    icon: string | null;
    color: string | null;
    pinned: boolean;
    archived: boolean;
    completed: boolean;
    sortOrder: number;
  }>
) {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.body !== undefined) { fields.push("body = ?"); values.push(data.body); }
  if (data.parentId !== undefined) { fields.push("parentId = ?"); values.push(data.parentId); }
  if (data.isDirectory !== undefined) { fields.push("isDirectory = ?"); values.push(data.isDirectory ? 1 : 0); }
  if (data.isTask !== undefined) { fields.push("isTask = ?"); values.push(data.isTask ? 1 : 0); }
  if (data.tags !== undefined) { fields.push("tags = ?"); values.push(JSON.stringify(data.tags)); }
  if (data.icon !== undefined) { fields.push("icon = ?"); values.push(data.icon); }
  if (data.color !== undefined) { fields.push("color = ?"); values.push(data.color); }
  if (data.pinned !== undefined) { fields.push("pinned = ?"); values.push(data.pinned ? 1 : 0); }
  if (data.archived !== undefined) { fields.push("archived = ?"); values.push(data.archived ? 1 : 0); }
  if (data.completed !== undefined) { fields.push("completed = ?"); values.push(data.completed ? 1 : 0); }
  if (data.sortOrder !== undefined) { fields.push("sortOrder = ?"); values.push(data.sortOrder); }

  if (fields.length === 0) return dbGetNoteById(id);

  fields.push("updatedAt = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE Note SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return dbGetNoteById(id);
}

export function dbDeleteNote(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM Note WHERE id = ?").run(id);
  return true;
}

export function dbPromoteToDirectory(id: string) {
  return dbUpdateNote(id, { isDirectory: true });
}

export function dbToggleTaskComplete(id: string, completed: boolean) {
  return dbUpdateNote(id, { completed });
}

export function dbAddNoteLink(fromId: string, toId: string) {
  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO NoteLink (fromNoteId, toNoteId) VALUES (?, ?)"
  ).run(fromId, toId);
  db.prepare(
    "INSERT OR IGNORE INTO NoteLink (fromNoteId, toNoteId) VALUES (?, ?)"
  ).run(toId, fromId);
  return true;
}

export function dbRemoveNoteLink(fromId: string, toId: string) {
  const db = getDb();
  db.prepare("DELETE FROM NoteLink WHERE fromNoteId = ? AND toNoteId = ?").run(fromId, toId);
  db.prepare("DELETE FROM NoteLink WHERE fromNoteId = ? AND toNoteId = ?").run(toId, fromId);
  return true;
}
