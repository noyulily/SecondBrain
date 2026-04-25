export interface Note {
  id: string;
  body: string;
  parentId: string | null;
  isDirectory: boolean;
  isDefaultModule: boolean;
  icon: string | null;
  color: string | null;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  isTask: boolean;
  completed: boolean;
  priority: 0 | 1 | 2 | 3;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  childCount?: number;
}

export interface NoteWithRelations extends Note {
  children: Note[];
  links: Note[];
  backlinks: Note[];
  attachments: Attachment[];
  parent: Note | null;
}

export interface Attachment {
  id: string;
  noteId: string;
  type: "IMAGE" | "AUDIO" | "URL";
  url: string | null;
  ogpTitle: string | null;
  ogpDesc: string | null;
  ogpImage: string | null;
  mimeType: string | null;
  localPath: string | null;
  createdAt: string;
}

export interface DirectoryNode extends Note {
  noteCount: number;
  dirCount: number;
  children: DirectoryNode[];
}

export interface GraphNode {
  id: string;
  body: string;
  icon: string | null;
  color: string | null;
  isDirectory: boolean;
  parentId: string | null;
  tags: string[];
}

export interface GraphEdge {
  fromId: string;
  toId: string;
  type: "parent" | "link";
}
