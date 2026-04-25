import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Check,
  Pencil,
  X,
  Hash,
  Link2,
  Search,
  CheckSquare,
  Square,
  Trash2,
  ChevronLeft,
  FolderOpen,
} from "lucide-react";
import { api } from "@/lib/api";
import type { NoteWithRelations, Note } from "@/lib/types";
import { cn } from "@/lib/utils";
import NoteCard from "@/components/NoteCard";

// ── Tag editor ────────────────────────────────────────────────────────────────

function TagEditor({
  noteId,
  initialTags,
  onChange,
}: {
  noteId: string;
  initialTags: string[];
  onChange?: () => void;
}) {
  const [tags, setTags] = useState(initialTags);
  const [input, setInput] = useState("");

  useEffect(() => {
    setTags(initialTags);
  }, [noteId]);

  async function commit(newTags: string[]) {
    setTags(newTags);
    await api.updateNote(noteId, { tags: newTags });
    onChange?.();
  }

  function add() {
    const tag = input.trim().replace(/^#/, "");
    if (tag && !tags.includes(tag)) commit([...tags, tag]);
    setInput("");
  }

  function remove(tag: string) {
    commit(tags.filter((t) => t !== tag));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-3">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 text-xs bg-muted text-muted-foreground rounded-full px-2.5 py-1"
        >
          #{tag}
          <button
            onClick={() => remove(tag)}
            className="hover:text-destructive ml-0.5"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <div className="flex items-center gap-1 text-xs text-muted-foreground border border-dashed border-border rounded-full px-2.5 py-1">
        <Hash size={11} />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === ",") {
              e.preventDefault();
              add();
            }
            if (e.key === "Backspace" && !input && tags.length)
              commit(tags.slice(0, -1));
          }}
          placeholder="タグ追加…"
          className="bg-transparent outline-none w-20 placeholder:text-muted-foreground/50"
        />
      </div>
    </div>
  );
}

// ── Link picker ───────────────────────────────────────────────────────────────

type LinkedNote = Pick<Note, "id" | "body" | "icon">;

function LinkPicker({
  noteId,
  linked,
  onChange,
}: {
  noteId: string;
  linked: LinkedNote[];
  onChange?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LinkedNote[]>([]);
  const [linkedNotes, setLinkedNotes] = useState(linked);

  async function handleSearch(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const res = await api.searchNotesForLink(q, noteId);
    setResults(res.map((r) => ({ id: r.id, body: r.body, icon: r.icon })));
  }

  async function link(target: LinkedNote) {
    if (linkedNotes.find((l) => l.id === target.id)) return;
    setLinkedNotes((l) => [...l, target]);
    setQuery("");
    setResults([]);
    await api.addNoteLink(noteId, target.id);
    onChange?.();
  }

  async function unlink(targetId: string) {
    setLinkedNotes((l) => l.filter((n) => n.id !== targetId));
    await api.removeNoteLink(noteId, targetId);
    onChange?.();
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <Link2 size={13} className="text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          関連メモ
        </span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-full px-2 py-0.5"
        >
          + リンク
        </button>
      </div>

      {linkedNotes.length > 0 && (
        <div className="space-y-1 mb-2">
          {linkedNotes.map((n) => (
            <div key={n.id} className="flex items-center gap-2 group text-sm">
              <Link
                to={`/note/${n.id}`}
                className="flex-1 truncate text-muted-foreground hover:text-foreground transition-colors"
              >
                {n.icon && <span className="mr-1">{n.icon}</span>}
                {n.body.slice(0, 60)}
                {n.body.length > 60 && "…"}
              </Link>
              <button
                onClick={() => unlink(n.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="border border-border rounded-xl p-3 bg-muted/30">
          <div className="flex items-center gap-2">
            <Search size={13} className="text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="メモを検索してリンク…"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          {results.length > 0 && (
            <div className="mt-2 space-y-1">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => link(r)}
                  className="w-full text-left text-sm px-2 py-1 rounded hover:bg-accent truncate text-muted-foreground hover:text-foreground"
                >
                  {r.icon && <span className="mr-1">{r.icon}</span>}
                  {r.body.slice(0, 80)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<NoteWithRelations | null>(null);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await api.getNoteById(id);
    if (!data) {
      navigate("/");
      return;
    }
    setNote(data);
    setBody(data.body);
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  if (!note) return null;

  async function handleSave() {
    if (!note) return;
    setSaving(true);
    await api.updateNote(note.id, { body });
    setSaving(false);
    setEditing(false);
    load();
  }

  async function toggleTask() {
    if (!note) return;
    await api.updateNote(note.id, { isTask: !note.isTask, completed: false });
    load();
  }

  async function toggleComplete() {
    if (!note) return;
    await api.updateNote(note.id, { completed: !note.completed });
    load();
  }

  async function handleDelete() {
    if (!note) return;
    if (confirm("このメモを削除しますか？")) {
      await api.deleteNote(note.id);
      navigate(note.parentId ? `/directory/${note.parentId}` : "/");
    }
  }

  const allLinked = [
    ...note.links,
    ...note.backlinks,
  ].filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Back link */}
      <div className="mb-4">
        {note.parent ? (
          <Link
            to={`/directory/${note.parent.id}`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} />
            {note.parent.icon} {note.parent.body}
          </Link>
        ) : (
          <Link
            to="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} />
            ホーム
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        {/* Task controls */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={toggleTask}
            className={cn(
              "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors",
              note.isTask
                ? "border-blue-500/50 text-blue-600 bg-blue-500/10"
                : "border-border text-muted-foreground hover:border-foreground/30"
            )}
          >
            {note.isTask ? <CheckSquare size={12} /> : <Square size={12} />}
            {note.isTask ? "タスク" : "タスク化"}
          </button>

          {note.isTask && (
            <button
              onClick={toggleComplete}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors",
                note.completed
                  ? "border-green-500/50 text-green-600 bg-green-500/10"
                  : "border-border text-muted-foreground"
              )}
            >
              <Check size={12} />
              {note.completed ? "完了済み" : "未完了"}
            </button>
          )}

          <button
            onClick={handleDelete}
            className="ml-auto p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10"
            title="削除"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Body */}
        {editing ? (
          <div className="space-y-2">
            <textarea
              className="w-full min-h-[120px] rounded-xl border border-border bg-muted/30 p-4 text-sm leading-relaxed outline-none resize-none focus:border-foreground/30 transition-colors"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                  e.preventDefault();
                  handleSave();
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setBody(note.body);
                  setEditing(false);
                }}
                className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs px-3 py-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/80 transition-colors flex items-center gap-1"
              >
                <Check size={12} />
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "group relative cursor-pointer rounded-xl p-4 hover:bg-muted/30 transition-colors",
              note.completed && "opacity-60"
            )}
            onClick={() => setEditing(true)}
          >
            <p
              className={cn(
                "text-base leading-relaxed whitespace-pre-wrap",
                note.completed && "line-through text-muted-foreground"
              )}
            >
              {note.icon && <span className="mr-2">{note.icon}</span>}
              {body || (
                <span className="text-muted-foreground italic">
                  クリックして編集…
                </span>
              )}
            </p>
            <Pencil
              size={13}
              className="absolute top-3 right-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        )}

        {/* Meta */}
        <p className="text-[11px] text-muted-foreground mt-2 px-4">
          {new Date(note.createdAt).toLocaleString("ja-JP")}
        </p>

        {/* Tags */}
        <TagEditor noteId={note.id} initialTags={note.tags} onChange={load} />

        {/* Links */}
        <LinkPicker noteId={note.id} linked={allLinked} onChange={load} />

        {/* Backlinks section */}
        {note.backlinks.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              ← このメモを参照しているメモ
            </p>
            <div className="space-y-1">
              {note.backlinks.map((bl) => (
                <Link
                  key={bl.id}
                  to={`/note/${bl.id}`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors truncate"
                >
                  {bl.icon && <span className="mr-1">{bl.icon}</span>}
                  {bl.body.slice(0, 80)}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Children — card grid for directories */}
        {note.isDirectory && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-3">
              <FolderOpen size={13} className="text-muted-foreground" />
              <Link
                to={`/directory/${note.id}`}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                中のメモ →
              </Link>
              <span className="text-xs text-muted-foreground/60">
                {note.children.length} 件
              </span>
            </div>
            {note.children.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 px-1">
                まだメモがありません
              </p>
            ) : (
              <div className="columns-1 sm:columns-2 gap-3">
                {note.children.map((child) => (
                  <NoteCard key={child.id} note={child} onMutate={load} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Children (non-directory plain list) */}
        {!note.isDirectory && note.children.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              子メモ
            </p>
            <div className="space-y-1">
              {note.children.map((child) => (
                <Link
                  key={child.id}
                  to={`/note/${child.id}`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors truncate"
                >
                  {child.icon && <span className="mr-1">{child.icon}</span>}
                  {child.body.slice(0, 80)}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
