import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Pencil, Check, X, Image } from "lucide-react";
import { api } from "@/lib/api";
import type { Note } from "@/lib/types";
import QuickInput from "@/components/QuickInput";
import MasonryGrid from "@/components/MasonryGrid";

// ─── Per-directory background ────────────────────────────────────────────────
function getDirBgKey(id: string) { return `dir-bg-${id}`; }
function loadDirBg(id: string): string | null { return localStorage.getItem(getDirBgKey(id)); }
function saveDirBg(id: string, dataUrl: string | null) {
  if (dataUrl) localStorage.setItem(getDirBgKey(id), dataUrl);
  else localStorage.removeItem(getDirBgKey(id));
}

function DirBackground({ dirId }: { dirId: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(() => loadDirBg(dirId));

  useEffect(() => {
    const bg = loadDirBg(dirId);
    setDataUrl(bg);
  }, [dirId]);

  if (!dataUrl) return null;
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        backgroundImage: `url("${dataUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: 0.15,
        zIndex: 0,
      }}
    />
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────
function DirectoryHeader({
  id, icon, body, noteCount, onRename,
}: {
  id: string; icon: string | null; body: string; noteCount: number; onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(body);
  const [saving, setSaving] = useState(false);
  const [hasBg, setHasBg] = useState(() => !!loadDirBg(id));
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setName(body); }, [body]);
  useEffect(() => { setHasBg(!!loadDirBg(id)); }, [id]);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    await api.updateNote(id, { body: name.trim() });
    setSaving(false);
    setEditing(false);
    onRename(name.trim());
    window.dispatchEvent(new Event("sidebar:refresh"));
  }

  function handleBgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      saveDirBg(id, dataUrl);
      setHasBg(true);
      window.dispatchEvent(new CustomEvent("dir-bg-changed", { detail: { id } }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleBgRemove() {
    saveDirBg(id, null);
    setHasBg(false);
    window.dispatchEvent(new CustomEvent("dir-bg-changed", { detail: { id } }));
  }

  return (
    <div className="mb-6 flex items-center gap-3 relative z-10">
      <span className="text-4xl">{icon ?? "📁"}</span>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") { setName(body); setEditing(false); }
              }}
              className="text-2xl font-bold bg-transparent border-b border-foreground/30 outline-none w-full"
            />
            <button onClick={save} disabled={saving} className="p-1 hover:text-green-500"><Check size={18} /></button>
            <button onClick={() => { setName(body); setEditing(false); }} className="p-1 hover:text-destructive"><X size={18} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <h2 className="text-2xl font-bold">{name}</h2>
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-opacity"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}
        <p className="text-sm text-muted-foreground mt-0.5">{noteCount} 件のメモ</p>
      </div>

      {/* Background image controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          title="このディレクトリの背景画像を設定"
        >
          <Image size={12} />
          {hasBg ? "BG変更" : "BG追加"}
        </button>
        {hasBg && (
          <button
            onClick={handleBgRemove}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-border text-destructive hover:bg-destructive/10 transition-colors"
          >
            <X size={12} />
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgFile} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DirectoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dir, setDir] = useState<Note | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [directories, setDirectories] = useState<Note[]>([]);
  const [bgKey, setBgKey] = useState(0); // force re-render background

  const load = useCallback(async () => {
    if (!id) return;
    const [dirData, notesData, dirsData] = await Promise.all([
      api.getNoteById(id),
      api.getNotes(id),
      api.getDirectories(),
    ]);
    if (!dirData) { navigate("/"); return; }
    setDir(dirData);
    setNotes(notesData);
    setDirectories(dirsData);
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => setBgKey((k) => k + 1);
    window.addEventListener("dir-bg-changed", handler);
    return () => window.removeEventListener("dir-bg-changed", handler);
  }, []);

  if (!dir) return null;

  return (
    <div className="relative min-h-screen">
      <DirBackground key={bgKey} dirId={dir.id} />
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8">
        <DirectoryHeader
          id={dir.id}
          icon={dir.icon}
          body={dir.body}
          noteCount={notes.length}
          onRename={(name) => setDir((d) => (d ? { ...d, body: name } : d))}
        />
        <QuickInput directories={directories} defaultParentId={id} onCreated={load} />
        <MasonryGrid notes={notes} onMutate={load} />
      </div>
    </div>
  );
}
