import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import {
  dbGetNotes,
  dbGetAllNotes,
  dbGetNoteById,
  dbCreateNote,
  dbUpdateNote,
  dbDeleteNote,
  dbPromoteToDirectory,
  dbToggleTaskComplete,
  dbGetDirectories,
  dbGetDirectoryTree,
  dbGetTasks,
  dbSearchNotes,
  dbSearchNotesForLink,
  dbGetGraphData,
  dbAddNoteLink,
  dbRemoveNoteLink,
  getDb,
} from "./db";

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0f0f0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function registerIpcHandlers() {
  ipcMain.handle("db:getNotes", (_e, parentId?: string | null) =>
    dbGetNotes(parentId)
  );
  ipcMain.handle("db:getAllNotes", () => dbGetAllNotes());
  ipcMain.handle("db:getNoteById", (_e, id: string) => dbGetNoteById(id));
  ipcMain.handle("db:createNote", (_e, data: unknown) =>
    dbCreateNote(data as Parameters<typeof dbCreateNote>[0])
  );
  ipcMain.handle("db:updateNote", (_e, id: string, data: unknown) =>
    dbUpdateNote(id, data as Parameters<typeof dbUpdateNote>[1])
  );
  ipcMain.handle("db:deleteNote", (_e, id: string) => dbDeleteNote(id));
  ipcMain.handle("db:promoteToDirectory", (_e, id: string) =>
    dbPromoteToDirectory(id)
  );
  ipcMain.handle(
    "db:toggleTaskComplete",
    (_e, id: string, completed: boolean) => dbToggleTaskComplete(id, completed)
  );
  ipcMain.handle("db:getDirectories", () => dbGetDirectories());
  ipcMain.handle("db:getDirectoryTree", () => dbGetDirectoryTree());
  ipcMain.handle("db:getTasks", () => dbGetTasks());
  ipcMain.handle("db:searchNotes", (_e, query: string) =>
    dbSearchNotes(query)
  );
  ipcMain.handle(
    "db:searchNotesForLink",
    (_e, query: string, excludeId: string) =>
      dbSearchNotesForLink(query, excludeId)
  );
  ipcMain.handle("db:getGraphData", () => dbGetGraphData());
  ipcMain.handle("db:addNoteLink", (_e, fromId: string, toId: string) =>
    dbAddNoteLink(fromId, toId)
  );
  ipcMain.handle("db:removeNoteLink", (_e, fromId: string, toId: string) =>
    dbRemoveNoteLink(fromId, toId)
  );

  // データ管理
  ipcMain.handle("db:exportAllJson", () => {
    const db = getDb();
    const notes = db.prepare("SELECT * FROM Note").all();
    const links = db.prepare("SELECT * FROM NoteLink").all();
    const attachments = db.prepare("SELECT * FROM Attachment").all();
    return JSON.stringify({ notes, links, attachments }, null, 2);
  });

  ipcMain.handle("db:getDataPath", () => {
    return app.getPath("userData");
  });

  ipcMain.handle("shell:openDataFolder", () => {
    shell.openPath(app.getPath("userData"));
  });
}
