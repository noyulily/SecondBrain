"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // Note CRUD
  getNotes: (parentId) => electron.ipcRenderer.invoke("db:getNotes", parentId),
  getAllNotes: () => electron.ipcRenderer.invoke("db:getAllNotes"),
  getNoteById: (id) => electron.ipcRenderer.invoke("db:getNoteById", id),
  createNote: (data) => electron.ipcRenderer.invoke("db:createNote", data),
  updateNote: (id, data) => electron.ipcRenderer.invoke("db:updateNote", id, data),
  deleteNote: (id) => electron.ipcRenderer.invoke("db:deleteNote", id),
  promoteToDirectory: (id) => electron.ipcRenderer.invoke("db:promoteToDirectory", id),
  toggleTaskComplete: (id, completed) => electron.ipcRenderer.invoke("db:toggleTaskComplete", id, completed),
  // Directory
  getDirectories: () => electron.ipcRenderer.invoke("db:getDirectories"),
  getDirectoryTree: () => electron.ipcRenderer.invoke("db:getDirectoryTree"),
  // Tasks
  getTasks: () => electron.ipcRenderer.invoke("db:getTasks"),
  // Search
  searchNotes: (query) => electron.ipcRenderer.invoke("db:searchNotes", query),
  searchNotesForLink: (query, excludeId) => electron.ipcRenderer.invoke("db:searchNotesForLink", query, excludeId),
  // Graph
  getGraphData: () => electron.ipcRenderer.invoke("db:getGraphData"),
  // Links
  addNoteLink: (fromId, toId) => electron.ipcRenderer.invoke("db:addNoteLink", fromId, toId),
  removeNoteLink: (fromId, toId) => electron.ipcRenderer.invoke("db:removeNoteLink", fromId, toId),
  // データ管理
  exportAllJson: () => electron.ipcRenderer.invoke("db:exportAllJson"),
  getDataPath: () => electron.ipcRenderer.invoke("db:getDataPath"),
  openDataFolder: () => electron.ipcRenderer.invoke("shell:openDataFolder")
});
//# sourceMappingURL=preload.js.map
