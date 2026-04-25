import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Trash2, ChevronDown, Clock, Flag, Layers } from "lucide-react";
import { api } from "@/lib/api";
import type { Note } from "@/lib/types";
import { cn } from "@/lib/utils";
import QuickInput from "@/components/QuickInput";

const PRIORITY_LABELS = ["なし", "低", "中", "高"] as const;
const PRIORITY_COLORS = [
  "text-muted-foreground/40 border-transparent",
  "text-sky-500 bg-sky-500/10 border-sky-500/30",
  "text-amber-500 bg-amber-500/10 border-amber-500/30",
  "text-rose-500 bg-rose-500/10 border-rose-500/30",
] as const;
const PRIORITY_DOT = ["", "bg-sky-500", "bg-amber-500", "bg-rose-500"] as const;

type SortMode = "dir" | "priority" | "date";

function PriorityBadge({ priority, onChange }: { priority: 0|1|2|3; onChange: (p: 0|1|2|3) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  function openDropdown() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    // 上に開くか下に開くか判定
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH = 140;
    const top = spaceBelow >= dropH ? rect.bottom + 4 : rect.top - dropH - 4;
    setPos({ top, left: rect.left });
    setOpen(true);
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={openDropdown}
        className={cn(
          "flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border transition-colors",
          PRIORITY_COLORS[priority]
        )}
        title="重要度を設定"
      >
        <Flag size={10} />
        {priority > 0 ? PRIORITY_LABELS[priority] : ""}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-24 bg-popover border border-border rounded-lg shadow-lg py-1 text-xs"
            style={{ top: pos.top, left: pos.left }}
          >
            {([0, 1, 2, 3] as const).map((p) => (
              <button
                key={p}
                onClick={() => { onChange(p); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-left",
                  p > 0 ? PRIORITY_COLORS[p] : "text-muted-foreground"
                )}
              >
                {p > 0 && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", PRIORITY_DOT[p])} />}
                {p === 0 && <span className="w-1.5 h-1.5 shrink-0" />}
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function TaskRow({ task, dirColor, onMutate }: { task: Note; dirColor: string; onMutate: () => void }) {
  const [pending, setPending] = useState(false);

  async function toggle(checked: boolean) {
    setPending(true);
    await api.toggleTaskComplete(task.id, checked);
    setPending(false);
    onMutate();
  }

  return (
    <div
      className={cn("flex items-start gap-3 py-2.5 group border-b border-border last:border-0 pl-3", task.completed && "opacity-50")}
      style={{ borderLeft: `3px solid ${dirColor}` }}
    >
      <input
        type="checkbox"
        checked={task.completed}
        onChange={(e) => toggle(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-foreground cursor-pointer shrink-0"
        disabled={pending}
      />
      <div className="flex-1 min-w-0">
        <Link to={`/note/${task.id}`}>
          <p className={cn("text-sm leading-relaxed", task.completed && "line-through text-muted-foreground")}>
            {task.priority > 0 && (
              <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5 mb-0.5 align-middle", PRIORITY_DOT[task.priority])} />
            )}
            {task.body}
          </p>
        </Link>
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {task.tags.map((t) => <span key={t} className="text-[11px] text-muted-foreground">#{t}</span>)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <PriorityBadge priority={task.priority as 0|1|2|3} onChange={async (p) => { await api.updateNote(task.id, { priority: p }); onMutate(); }} />
        <button onClick={async () => { await api.deleteNote(task.id); onMutate(); }} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-destructive transition-all">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Note[]>([]);
  const [directories, setDirectories] = useState<Note[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("dir");

  const load = useCallback(async () => {
    const [t, d] = await Promise.all([api.getTasks(), api.getDirectories()]);
    setTasks(t);
    setDirectories(d);
  }, []);

  useEffect(() => { load(); }, [load]);

  const dirColorMap = new Map(directories.map((d) => [d.id, d.color ?? "#6B7280"]));
  function getDirColor(task: Note) { return task.parentId ? (dirColorMap.get(task.parentId) ?? "#6B7280") : "#6B7280"; }

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  // フラットソート
  function sortFlat(list: Note[]): Note[] {
    return [...list].sort((a, b) => {
      if (sortMode === "priority") {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  // ディレクトリ別グループ
  type Group = { dirId: string|null; dirName: string; color: string; tasks: Note[] };
  function groupByDir(list: Note[]): Group[] {
    const map = new Map<string, Group>();
    for (const task of list) {
      const key = task.parentId ?? "__inbox__";
      if (!map.has(key)) {
        const dir = task.parentId ? directories.find((d) => d.id === task.parentId) : null;
        map.set(key, {
          dirId: task.parentId ?? null,
          dirName: dir ? `${dir.icon ?? "📁"} ${dir.body}` : "📥 Inbox",
          color: dir?.color ?? "#6B7280",
          tasks: [],
        });
      }
      map.get(key)!.tasks.push(task);
    }
    return Array.from(map.values());
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">⏰ タスク</h2>
          <p className="text-sm text-muted-foreground mt-1">今やること・やりたいこと</p>
        </div>
        {/* 表示モード切り替え */}
        <div className="flex items-center gap-1 mt-1 border border-border rounded-lg overflow-hidden text-xs">
          <button
            onClick={() => setSortMode("dir")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 transition-colors", sortMode === "dir" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50")}
          >
            <Layers size={11} /> ディレクトリ別
          </button>
          <button
            onClick={() => setSortMode("priority")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 transition-colors", sortMode === "priority" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50")}
          >
            <Flag size={11} /> 重要度順
          </button>
          <button
            onClick={() => setSortMode("date")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 transition-colors", sortMode === "date" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50")}
          >
            <Clock size={11} /> 時系列順
          </button>
        </div>
      </div>

      <QuickInput directories={directories} defaultIsTask={true} onCreated={load} />

      <div className="space-y-6">
        {open.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <p className="text-sm text-muted-foreground text-center py-8">未完了のタスクはありません 🎉</p>
          </div>
        ) : sortMode === "dir" ? (
          /* ディレクトリ別グループ表示 */
          <div className="space-y-4">
            {groupByDir(open).map((group) => (
              <div key={group.dirId ?? "__inbox__"} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border" style={{ borderLeft: `4px solid ${group.color}` }}>
                  <span className="text-xs font-medium text-muted-foreground">{group.dirName}</span>
                  <span className="text-[11px] text-muted-foreground/60 ml-auto">{group.tasks.length}</span>
                </div>
                <div className="px-1">
                  {group.tasks.map((t) => (
                    <TaskRow key={t.id} task={t} dirColor={group.color} onMutate={load} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* フラットリスト（重要度順 or 時系列順） */
          <div className="rounded-xl border border-border bg-card px-1">
            {sortFlat(open).map((t) => (
              <TaskRow key={t.id} task={t} dirColor={getDirColor(t)} onMutate={load} />
            ))}
          </div>
        )}

        {done.length > 0 && (
          <div>
            <button
              onClick={() => setShowDone((s) => !s)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 hover:text-foreground transition-colors"
            >
              <ChevronDown size={13} className={cn("transition-transform", showDone && "rotate-180")} />
              完了済み ({done.length})
            </button>
            {showDone && (
              <div className="rounded-xl border border-border bg-card px-1">
                {sortFlat(done).map((t) => (
                  <TaskRow key={t.id} task={t} dirColor={getDirColor(t)} onMutate={load} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
