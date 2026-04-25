import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Pin,
  Archive,
  FolderPlus,
  Folder,
  FolderInput,
  Trash2,
  MoreHorizontal,
  CheckSquare,
  Square,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Note } from "@/lib/types";

export default function NoteCard({
  note,
  onMutate,
}: {
  note: Note;
  onMutate?: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [directories, setDirectories] = useState<Pick<Note, "id" | "body" | "icon">[]>([]);
  const [pending, setPending] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (showMovePicker && directories.length === 0) {
      api.getDirectories().then((dirs) =>
        setDirectories(dirs.map((d) => ({ id: d.id, body: d.body, icon: d.icon })))
      );
    }
  }, [showMovePicker]);

  const childCount = note.childCount ?? 0;
  const borderColor = note.color ?? "#6B7280";

  async function run(fn: () => Promise<unknown>) {
    setPending(true);
    await fn();
    setPending(false);
    onMutate?.();
    window.dispatchEvent(new Event("sidebar:refresh"));
  }

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuH = 260; // approximate menu height
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= menuH
      ? rect.bottom + 4
      : rect.top - menuH - 4;
    const left = Math.min(rect.right - 176, window.innerWidth - 184);
    setMenuPos({ top, left });
    setShowMenu(true);
    setShowMovePicker(false);
  }

  return (
    <div
      className={cn(
        "relative group rounded-xl border-l-4 bg-card shadow-sm hover:shadow-md transition-shadow p-4 break-inside-avoid mb-3",
        note.completed && "opacity-60"
      )}
      style={{ borderLeftColor: borderColor }}
    >
      {note.pinned && (
        <span className="absolute top-2 right-2 text-amber-400">
          <Pin size={12} fill="currentColor" />
        </span>
      )}

      {note.isDirectory && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <Folder size={12} className="text-muted-foreground" />
          {childCount > 0 && (
            <span className="text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
              {childCount}
            </span>
          )}
        </div>
      )}

      <div className="flex items-start gap-2">
        {note.isTask && (
          <button
            onClick={() => run(() => api.toggleTaskComplete(note.id, !note.completed))}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
            disabled={pending}
          >
            {note.completed ? (
              <CheckSquare size={15} className="text-green-500" />
            ) : (
              <Square size={15} />
            )}
          </button>
        )}
        <Link to={`/note/${note.id}`} className="block flex-1 min-w-0">
          <p className={cn(
            "text-sm leading-relaxed whitespace-pre-wrap",
            note.completed && "line-through text-muted-foreground"
          )}>
            {note.body}
          </p>
        </Link>
      </div>

      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {note.tags.map((tag) => (
            <Link
              key={tag}
              to={`/search?q=%23${encodeURIComponent(tag)}`}
              className="text-xs text-blue-500 hover:underline"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] text-muted-foreground">
          {new Date(note.createdAt).toLocaleDateString("ja-JP", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>

        <button
          ref={btnRef}
          onClick={openMenu}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => { setShowMenu(false); setShowMovePicker(false); }}
          />
          <div
            className="fixed z-50 w-44 bg-popover border border-border rounded-lg shadow-lg py-1 text-sm"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              onClick={() => { run(() => api.updateNote(note.id, { pinned: !note.pinned })); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-left"
            >
              <Pin size={13} />
              {note.pinned ? "ピン解除" : "ピン留め"}
            </button>
            <button
              onClick={() => { run(() => api.updateNote(note.id, { isTask: !note.isTask })); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-left"
            >
              <CheckSquare size={13} />
              {note.isTask ? "タスク解除" : "タスク化"}
            </button>
            {!note.isDirectory && (
              <button
                onClick={() => { run(() => api.promoteToDirectory(note.id)); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-left"
              >
                <FolderPlus size={13} />
                ディレクトリ化
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setShowMovePicker((v) => !v)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-left"
              >
                <FolderInput size={13} />
                <span className="flex-1">移動</span>
                <ChevronRight size={11} className="text-muted-foreground" />
              </button>
              {showMovePicker && (
                <div className="absolute left-full top-0 ml-1 w-48 bg-popover border border-border rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto z-50">
                  <button
                    onClick={() => { run(() => api.updateNote(note.id, { parentId: null })); setShowMenu(false); setShowMovePicker(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-left text-sm"
                  >
                    <span>📥</span> Inbox
                  </button>
                  {directories.map((dir) => (
                    <button
                      key={dir.id}
                      onClick={() => { run(() => api.updateNote(note.id, { parentId: dir.id })); setShowMenu(false); setShowMovePicker(false); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-left text-sm truncate"
                    >
                      <span>{dir.icon ?? "📁"}</span>
                      <span className="truncate">{dir.body}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => { run(() => api.updateNote(note.id, { archived: true })); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-left"
            >
              <Archive size={13} />
              アーカイブ
            </button>
            <hr className="my-1 border-border" />
            <button
              onClick={() => { if (confirm("削除しますか？")) { run(() => api.deleteNote(note.id)); } setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-destructive/10 text-destructive text-left"
            >
              <Trash2 size={13} />
              削除
            </button>
          </div>
        </>
      )}
    </div>
  );
}
