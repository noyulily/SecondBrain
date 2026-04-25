import { contextBridge, ipcRenderer } from "electron";

// レンダラーに公開するAPI
contextBridge.exposeInMainWorld("electronAPI", {
  // Note CRUD
  getNotes: (parentId?: string | null) =>
    ipcRenderer.invoke("db:getNotes", parentId),
  getAllNotes: () => ipcRenderer.invoke("db:getAllNotes"),
  getNoteById: (id: string) => ipcRenderer.invoke("db:getNoteById", id),
  createNote: (data: unknown) => ipcRenderer.invoke("db:createNote", data),
  updateNote: (id: string, data: unknown) =>
    ipcRenderer.invoke("db:updateNote", id, data),
  deleteNote: (id: string) => ipcRenderer.invoke("db:deleteNote", id),
  promoteToDirectory: (id: string) =>
    ipcRenderer.invoke("db:promoteToDirectory", id),
  toggleTaskComplete: (id: string, completed: boolean) =>
    ipcRenderer.invoke("db:toggleTaskComplete", id, completed),

  // Directory
  getDirectories: () => ipcRenderer.invoke("db:getDirectories"),
  getDirectoryTree: () => ipcRenderer.invoke("db:getDirectoryTree"),

  // Tasks
  getTasks: () => ipcRenderer.invoke("db:getTasks"),

  // Search
  searchNotes: (query: string) => ipcRenderer.invoke("db:searchNotes", query),
  searchNotesForLink: (query: string, excludeId: string) =>
    ipcRenderer.invoke("db:searchNotesForLink", query, excludeId),

  // Graph
  getGraphData: () => ipcRenderer.invoke("db:getGraphData"),

  // Links
  addNoteLink: (fromId: string, toId: string) =>
    ipcRenderer.invoke("db:addNoteLink", fromId, toId),
  removeNoteLink: (fromId: string, toId: string) =>
    ipcRenderer.invoke("db:removeNoteLink", fromId, toId),

  // データ管理
  exportAllJson: () => ipcRenderer.invoke("db:exportAllJson"),
  getDataPath: () => ipcRenderer.invoke("db:getDataPath"),
  openDataFolder: () => ipcRenderer.invoke("shell:openDataFolder"),
});
