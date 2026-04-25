import { useState, useRef, useEffect } from "react";
import { Send, ChevronDown, CheckSquare, Square, X, Hash, Link2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Note } from "@/lib/types";

type CreateData = {
  body: string;
  parentId?: string | null;
  tags?: string[];
  isTask?: boolean;
};

type Directory = Pick<Note, "id" | "icon" | "body" | "color">;
type LinkedNote = Pick<Note, "id" | "body" | "icon">;

export default function QuickInput({
  directories,
  defaultParentId,
  defaultIsTask,
  onCreated,
}: {
  directories: Directory[];
  defaultParentId?: string | null;
  defaultIsTask?: boolean;
  onCreated?: () => void;
}) {
  const [body, setBody] = useState("");
  const [selectedDirId, setSelectedDirId] = useState<string | null>(
    defaultParentId ?? null
  );
  const [isTask, setIsTask] = useState(defaultIsTask ?? false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [showDirPicker, setShowDirPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Link picker state
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkResults, setLinkResults] = useState<LinkedNote[]>([]);
  const [linkedNotes, setLinkedNotes] = useState<LinkedNote[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSelectedDirId(defaultParentId ?? null);
  }, [defaultParentId]);

  const selectedDir = directories.find((d) => d.id === selectedDirId);

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setBody(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === " " || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().replace(/^#/, "");
      if (tag && !tags.includes(tag)) setTags((t) => [...t, tag]);
      setTagInput("");
    }
    if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((t) => t.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    setTags((t) => t.filter((x) => x !== tag));
  }

  async function handleLinkSearch(q: string) {
    setLinkQuery(q);
    if (!q.trim()) { setLinkResults([]); return; }
    const res = await api.searchNotesForLink(q, "");
    const filtered = res
      .filter((r) => !linkedNotes.find((l) => l.id === r.id))
      .map((r) => ({ id: r.id, body: r.body, icon: r.icon }));
    setLinkResults(filtered);
  }

  function addLink(note: LinkedNote) {
    if (linkedNotes.find((l) => l.id === note.id)) return;
    setLinkedNotes((l) => [...l, note]);
    setLinkQuery("");
    setLinkResults([]);
  }

  function removeLink(id: string) {
    setLinkedNotes((l) => l.filter((n) => n.id !== id));
  }

  async function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    const data: CreateData = { body: trimmed, parentId: selectedDirId, tags, isTask };
    setBody("");
    setTags([]);
    setTagInput("");
    setLinkedNotes([]);
    setShowLinkPicker(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    const created = await api.createNote(data);
    if (created && linkedNotes.length > 0) {
      await Promise.all(linkedNotes.map((ln) => api.addNoteLink(created.id, ln.id)));
    }
    setSubmitting(false);
    onCreated?.();
    window.dispatchEvent(new Event("sidebar:refresh"));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-4 mb-6">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="今何を考えてる？思ったことをそのまま書いて… (⌘+Enter で投稿)"
        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground min-h-[52px] leading-relaxed"
        rows={2}
      />

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2 mb-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5"
          >
            #{tag}
            <button onClick={() => removeTag(tag)} className="hover:text-foreground">
              <X size={10} />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1 text-muted-foreground">
          <Hash size={12} />
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="タグを追加…"
            className="text-xs bg-transparent outline-none w-24 placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Link picker */}
      {showLinkPicker && (
        <div className="mb-3 border border-border rounded-lg p-3 bg-muted/20">
          <div className="flex items-center gap-2 mb-2">
            <Search size={12} className="text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={linkQuery}
              onChange={(e) => handleLinkSearch(e.target.value)}
              placeholder="メモを検索してリンク…"
              className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          {linkResults.length > 0 && (
            <div className="space-y-0.5 max-h-36 overflow-y-auto">
              {linkResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => addLink(r)}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground truncate"
                >
                  {r.icon && <span className="mr-1">{r.icon}</span>}
                  {r.body.slice(0, 80)}
                </button>
              ))}
            </div>
          )}
          {linkedNotes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border">
              {linkedNotes.map((n) => (
                <span
                  key={n.id}
                  className="flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5"
                >
                  <Link2 size={9} />
                  {n.body.slice(0, 24)}{n.body.length > 24 && "…"}
                  <button onClick={() => removeLink(n.id)} className="hover:text-destructive ml-0.5">
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom toolbar */}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <button
          onClick={() => setIsTask((t) => !t)}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-colors",
            isTask
              ? "border-blue-500/50 text-blue-600 bg-blue-500/10"
              : "border-border text-muted-foreground hover:border-foreground/30"
          )}
        >
          {isTask ? <CheckSquare size={12} /> : <Square size={12} />}
          タスク
        </button>

        <button
          onClick={() => setShowLinkPicker((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-colors",
            showLinkPicker || linkedNotes.length > 0
              ? "border-primary/50 text-primary bg-primary/10"
              : "border-border text-muted-foreground hover:border-foreground/30"
          )}
        >
          <Link2 size={12} />
          リンク{linkedNotes.length > 0 && ` (${linkedNotes.length})`}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowDirPicker(!showDirPicker)}
            className={cn(
              "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors",
              selectedDir
                ? "border-transparent text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/30"
            )}
            style={
              selectedDir?.color
                ? { backgroundColor: `${selectedDir.color}20`, borderColor: `${selectedDir.color}60` }
                : {}
            }
          >
            <span>{selectedDir?.icon ?? "📥"}</span>
            <span>{selectedDir?.body ?? "Inbox"}</span>
            <ChevronDown size={11} />
          </button>

          {showDirPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDirPicker(false)} />
              <div className="absolute left-0 top-8 z-20 w-52 bg-popover border border-border rounded-xl shadow-lg py-2 max-h-64 overflow-y-auto">
                <button
                  onClick={() => { setSelectedDirId(null); setShowDirPicker(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                >
                  <span>📥</span> Inbox
                </button>
                {directories.map((dir) => (
                  <button
                    key={dir.id}
                    onClick={() => { setSelectedDirId(dir.id); setShowDirPicker(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                  >
                    <span>{dir.icon ?? "📁"}</span>
                    <span className="truncate">{dir.body}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {directories
          .filter((d) => d.id !== selectedDirId)
          .slice(0, 3)
          .map((dir) => (
            <button
              key={dir.id}
              onClick={() => setSelectedDirId(dir.id)}
              className="text-xs px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              title={dir.body}
            >
              {dir.icon ?? "📁"}
            </button>
          ))}

        <button
          onClick={handleSubmit}
          disabled={!body.trim() || submitting}
          className={cn(
            "ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors",
            body.trim() && !submitting
              ? "bg-foreground text-background hover:bg-foreground/80"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          <Send size={12} />
          投稿
        </button>
      </div>
    </div>
  );
}
