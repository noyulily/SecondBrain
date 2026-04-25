import { Link, useLocation } from "react-router-dom";
import {
  Home, Search, Settings, CheckSquare, GitFork,
  Pencil, Check, X, Plus, Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { DirectoryNode } from "@/lib/types";

const TOP_NAV: { href: string; icon: LucideIcon | null; label: string }[] = [
  { href: "/",         icon: Home,     label: "ホーム" },
  { href: "/tasks",    icon: CheckSquare, label: "タスク" },
  { href: "/brain",    icon: GitFork,     label: "MindMap" },
  { href: "/search",   icon: Search,   label: "検索" },
  { href: "/settings", icon: Settings, label: "設定" },
];

function TreeNode({
  node, depth, pathname, onMutate,
}: {
  node: DirectoryNode; depth: number; pathname: string; onMutate: () => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(node.body);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasChildren = node.children.length > 0;
  const isActive = pathname === `/directory/${node.id}`;

  function startRename(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setRenaming(true);
    setTimeout(() => inputRef.current?.select(), 10);
  }

  async function commitRename() {
    const trimmed = name.trim();
    if (!trimmed) { setName(node.body); setRenaming(false); return; }
    setSaving(true);
    await api.updateNote(node.id, { body: trimmed });
    setSaving(false); setRenaming(false); onMutate();
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await api.deleteNote(node.id); onMutate();
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center text-[14px] leading-6 select-none group relative",
          "hover:bg-accent",
          isActive && "bg-accent"
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onMouseLeave={() => setConfirmDelete(false)}
      >
        <button
          className="w-4 h-5 flex items-center justify-center shrink-0 opacity-50 hover:opacity-100"
          onClick={() => hasChildren && setOpen((o) => !o)}
          tabIndex={-1}
        >
          {hasChildren
            ? <span className="text-[10px] text-muted-foreground">{open ? "▼" : "▶"}</span>
            : <span className="w-1" />}
        </button>

        {renaming ? (
          <div className="flex items-center flex-1 min-w-0 gap-1 py-0.5 pr-1">
            <span className="text-sm leading-none shrink-0">{node.icon ?? "📁"}</span>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setName(node.body); setRenaming(false); } }}
              onBlur={commitRename}
              className="flex-1 min-w-0 bg-input text-foreground text-[13px] px-1 rounded outline-none ring-1 ring-ring"
              autoFocus
              disabled={saving}
            />
            <button onClick={commitRename} className="text-primary hover:text-foreground shrink-0"><Check size={11} /></button>
            <button onClick={() => { setName(node.body); setRenaming(false); }} className="text-muted-foreground hover:text-foreground shrink-0"><X size={11} /></button>
          </div>
        ) : (
          <Link
            to={`/directory/${node.id}`}
            className={cn(
              "flex items-center gap-1.5 py-0.5 flex-1 min-w-0 truncate",
              isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => !open && hasChildren && setOpen(true)}
          >
            <span className="text-sm leading-none">{node.icon ?? "📁"}</span>
            <span className="truncate">{name}</span>
            {node.noteCount > 0 && (
              <span className="ml-auto pr-1 text-[11px] text-muted-foreground/60 shrink-0">{node.noteCount}</span>
            )}
          </Link>
        )}

        {!renaming && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0 mr-1 gap-0.5 transition-opacity">
            <button onClick={startRename} className="p-0.5 text-muted-foreground hover:text-foreground" title="名称変更">
              <Pencil size={10} />
            </button>
            {!node.isDefaultModule && (
              <button
                onClick={handleDelete}
                className={cn("p-0.5 transition-colors hover:text-foreground", confirmDelete ? "text-destructive" : "text-muted-foreground")}
                title={confirmDelete ? "もう一度クリックで削除" : "削除"}
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        )}
      </div>

      {open && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child as DirectoryNode} depth={depth + 1} pathname={pathname} onMutate={onMutate} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewDirectoryInput({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) { onCancel(); return; }
    setCreating(true);
    await api.createNote({ body: trimmed, isDirectory: true });
    setCreating(false); onCreated();
  }

  return (
    <div className="flex items-center gap-1 px-2 py-0.5 bg-accent">
      <span className="text-sm">📁</span>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") create(); if (e.key === "Escape") onCancel(); }}
        onBlur={() => { if (!name.trim()) onCancel(); }}
        placeholder="ディレクトリ名…"
        className="flex-1 min-w-0 bg-input text-foreground text-[13px] px-1 rounded outline-none ring-1 ring-ring placeholder:text-muted-foreground/50"
        disabled={creating}
      />
      <button onClick={create} className="text-primary hover:text-foreground shrink-0"><Check size={11} /></button>
      <button onClick={onCancel} className="text-muted-foreground hover:text-foreground shrink-0"><X size={11} /></button>
    </div>
  );
}

export default function Sidebar({ tree }: { tree: DirectoryNode[] }) {
  const location = useLocation();
  const pathname = location.pathname;
  const [creating, setCreating] = useState(false);

  function handleMutate() {
    window.dispatchEvent(new Event("sidebar:refresh"));
  }

  return (
    <aside className="w-1/6 min-w-44 max-w-60 shrink-0 h-screen sticky top-0 border-r border-border flex flex-col bg-secondary overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-3 border-b border-border">
        <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
          SECOND BRAIN
        </span>
      </div>

      {/* Top nav */}
      <nav className="py-1">
        {TOP_NAV.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              to={href}
              className={cn(
                "flex items-center gap-2.5 px-4 py-1 text-[14px] leading-7 transition-colors",
                "hover:bg-accent hover:text-foreground",
                isActive ? "bg-accent text-foreground font-medium" : "text-muted-foreground"
              )}
            >
              {Icon && <Icon size={14} className="shrink-0 opacity-70" />}
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Directories */}
      <div className="mt-2 border-t border-border">
        <div className="px-4 py-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            Sections
          </span>
          <button
            onClick={() => setCreating(true)}
            className="text-muted-foreground hover:text-foreground p-0.5 transition-colors"
            title="新規ディレクトリ"
          >
            <Plus size={13} />
          </button>
        </div>
        <div className="py-1">
          {tree.map((node) => (
            <TreeNode key={node.id} node={node} depth={0} pathname={pathname} onMutate={handleMutate} />
          ))}
          {creating && (
            <NewDirectoryInput
              onCreated={() => { setCreating(false); handleMutate(); }}
              onCancel={() => setCreating(false)}
            />
          )}
        </div>
      </div>
    </aside>
  );
}
