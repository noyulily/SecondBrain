/**
 * Tauri invoke経由でRust/SQLiteを呼び出すAPI層
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  Note,
  NoteWithRelations,
  DirectoryNode,
  GraphNode,
  GraphEdge,
} from "./types";

export const api = {
  getNotes: (parentId?: string | null) =>
    invoke<Note[]>("get_notes", { parentId: parentId ?? null }),

  getAllNotes: () => invoke<Note[]>("get_all_notes"),

  getNoteById: (id: string) =>
    invoke<NoteWithRelations | null>("get_note_by_id", { id }),

  createNote: (data: {
    body: string;
    parentId?: string | null;
    isDirectory?: boolean;
    isTask?: boolean;
    tags?: string[];
    icon?: string;
    color?: string;
  }) => invoke<NoteWithRelations | null>("create_note", { data }),

  updateNote: (
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
      priority: number;
      sortOrder: number;
    }>
  ) => invoke<NoteWithRelations | null>("update_note", { id, data }),

  deleteNote: (id: string) => invoke<boolean>("delete_note", { id }),

  promoteToDirectory: (id: string) =>
    invoke<NoteWithRelations | null>("promote_to_directory", { id }),

  toggleTaskComplete: (id: string, completed: boolean) =>
    invoke<NoteWithRelations | null>("toggle_task_complete", { id, completed }),

  getDirectories: () => invoke<DirectoryNode[]>("get_directories"),

  getDirectoryTree: () => invoke<DirectoryNode[]>("get_directory_tree"),

  getTasks: () => invoke<Note[]>("get_tasks"),

  searchNotes: (query: string) =>
    invoke<Note[]>("search_notes", { query }),

  searchNotesForLink: (query: string, excludeId: string) =>
    invoke<Note[]>("search_notes_for_link", { query, excludeId }),

  getGraphData: () =>
    invoke<{ nodes: GraphNode[]; edges: GraphEdge[] }>("get_graph_data"),

  addNoteLink: (fromId: string, toId: string) =>
    invoke<boolean>("add_note_link", { fromId, toId }),

  removeNoteLink: (fromId: string, toId: string) =>
    invoke<boolean>("remove_note_link", { fromId, toId }),

  exportAllJson: () => invoke<string>("export_all_json"),

  getDataPath: () => invoke<string>("get_data_path"),

  openDataFolder: () => invoke<void>("open_data_folder"),
};
