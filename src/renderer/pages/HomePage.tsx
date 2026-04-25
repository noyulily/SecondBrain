import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { Note } from "@/lib/types";
import QuickInput from "@/components/QuickInput";
import MasonryGrid from "@/components/MasonryGrid";
import { ImagePlus, X } from "lucide-react";

const HOME_BG_KEY = "home-bg";

function loadHomeBg(): string | null {
  try { return localStorage.getItem(HOME_BG_KEY); } catch { return null; }
}
function saveHomeBg(dataUrl: string | null) {
  try {
    if (dataUrl) localStorage.setItem(HOME_BG_KEY, dataUrl);
    else localStorage.removeItem(HOME_BG_KEY);
  } catch { /* quota */ }
}

export default function HomePage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [directories, setDirectories] = useState<Note[]>([]);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [allNotes, dirs] = await Promise.all([
      api.getAllNotes(),
      api.getDirectories(),
    ]);
    setNotes(allNotes.filter((n) => !n.isDefaultModule && !n.isDirectory));
    setDirectories(dirs);
  }, []);

  useEffect(() => {
    load();
    setBgUrl(loadHomeBg());
  }, [load]);

  function handleBgSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      saveHomeBg(dataUrl);
      setBgUrl(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleBgRemove() {
    saveHomeBg(null);
    setBgUrl(null);
  }

  return (
    <div className="relative min-h-screen">
      {bgUrl && (
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `url("${bgUrl}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.38,
          }}
        />
      )}
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">ホーム</h2>
            <p className="text-sm text-muted-foreground mt-1">
              今日も脳の中を整理しよう
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <ImagePlus size={13} />
              {bgUrl ? "BG変更" : "BG追加"}
            </button>
            {bgUrl && (
              <button
                onClick={handleBgRemove}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                title="背景を削除"
              >
                <X size={13} />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBgSelect}
            />
          </div>
        </div>
        <QuickInput directories={directories} onCreated={load} />
        <MasonryGrid notes={notes} onMutate={load} />
      </div>
    </div>
  );
}
