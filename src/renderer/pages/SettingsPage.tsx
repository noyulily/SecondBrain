import { useRef, useState } from "react";
import { FolderOpen, Download, Database, Palette, Image, X, Sun, Moon, Monitor } from "lucide-react";
import { api } from "@/lib/api";
import {
  THEMES, applyTheme, loadTheme, loadColorMode,
  applyBackground, saveBackground, loadBackground,
} from "@/lib/themes";
import type { ThemeId, ColorMode } from "@/lib/themes";
import { cn } from "@/lib/utils";

// ─── Theme preview mini card ─────────────────────────────────────────────────
const THEME_COLORS: Record<ThemeId, { bg: string; card: string; accent: string }> = {
  linear:    { bg: "#fbfbfc", card: "#fff",     accent: "#5e6ad2" },
  things:    { bg: "#f5f5f7", card: "#fff",     accent: "#007aff" },
  cyberpunk: { bg: "#0a0a15", card: "#12122a",  accent: "#ff006e" },
  washi:     { bg: "#f4ede0", card: "#fbf7ec",  accent: "#8b2a2a" },
  newspaper: { bg: "#f7f4ed", card: "#fff",     accent: "#111111" },
  pastel:    { bg: "#fdf6fb", card: "#fff",     accent: "#c06090" },
  terminal:  { bg: "#0d1117", card: "#161b22",  accent: "#7ee787" },
  y2k:       { bg: "#0a0a2a", card: "#000",     accent: "#00ff41" },
  braun:     { bg: "#ececec", card: "#fff",     accent: "#ff6b1a" },
  dawn:      { bg: "#fff0e0", card: "#ffffffbb",accent: "#e05020" },
  ocean:     { bg: "#0a1520", card: "#142838",  accent: "#6cb6ff" },
  crayon:    { bg: "#fff9e6", card: "#fff",     accent: "#ff6b6b" },
};

function ThemePreview({ id }: { id: ThemeId }) {
  const c = THEME_COLORS[id];
  return (
    <div className="w-full h-10 rounded overflow-hidden border border-border/50 shrink-0"
      style={{ background: c.bg }}>
      <div className="flex gap-1 p-1.5 h-full items-end">
        <div className="rounded-sm flex-1 h-5" style={{ background: c.card, border: `2px solid ${c.accent}`, borderLeftWidth: "3px" }} />
        <div className="rounded-sm w-3 h-5" style={{ background: c.card, borderLeft: `3px solid ${c.accent}` }} />
        <div className="rounded-sm w-5 h-3 mt-auto" style={{ background: c.accent }} />
      </div>
    </div>
  );
}

const PHASE_LABELS = { 1: "✓ 完全実装", 2: "Phase 2", 3: "Phase 3" } as const;

export default function SettingsPage() {
  const [dataPath, setDataPath] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(loadTheme);
  const [colorMode, setColorMode] = useState<ColorMode>(loadColorMode);
  const [hasBg, setHasBg] = useState<boolean>(() => !!loadBackground());
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function exportJson() {
    setExporting(true);
    try {
      const json = await api.exportAllJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `second-brain-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function handleThemeSelect(id: ThemeId) {
    setCurrentTheme(id);
    applyTheme(id, colorMode);
  }

  function handleModeSelect(mode: ColorMode) {
    setColorMode(mode);
    applyTheme(currentTheme, mode);
  }

  function handleBgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      saveBackground(dataUrl);
      applyBackground(dataUrl);
      setHasBg(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleBgRemove() {
    saveBackground(null);
    applyBackground(null);
    setHasBg(false);
  }

  const MODES: { id: ColorMode; icon: typeof Sun; label: string }[] = [
    { id: "light",  icon: Sun,     label: "Light" },
    { id: "dark",   icon: Moon,    label: "Dark" },
    { id: "system", icon: Monitor, label: "Follow OS" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">⚙️ Settings</h2>
      </div>

      <div className="space-y-4">
        {/* Theme */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Palette size={16} className="text-muted-foreground" />
              <h3 className="font-semibold text-sm">Theme</h3>
            </div>
            {/* Light / Dark / System toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              {MODES.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => handleModeSelect(id)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all",
                    colorMode === id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeSelect(theme.id)}
                className={cn(
                  "flex flex-col gap-2 p-3 rounded-lg border text-left transition-all",
                  currentTheme === theme.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:border-foreground/20 hover:bg-accent/50"
                )}
              >
                <ThemePreview id={theme.id} />
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm leading-none">{theme.emoji}</span>
                      <span className="font-medium text-xs">{theme.name}</span>
                      {currentTheme === theme.id && <span className="text-primary text-xs">✓</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{theme.description}</div>
                  </div>
                  <span className={cn(
                    "text-[9px] shrink-0 px-1 py-0.5 rounded",
                    theme.phase === 1 ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                  )}>
                    {PHASE_LABELS[theme.phase]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Background image */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Image size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-sm">背景画像（グローバル）</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            アプリ全体の背景に画像を設定します。半透明で薄く表示されます。ディレクトリごとの背景はディレクトリページで設定できます。
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
            >
              <Image size={13} />
              {hasBg ? "画像を変更" : "画像を選択"}
            </button>
            {hasBg && (
              <button
                onClick={handleBgRemove}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border text-destructive hover:bg-destructive/10 transition-colors"
              >
                <X size={13} />
                背景を削除
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgFile} />
        </div>

        {/* Data location */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Database size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-sm">データの保存場所</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            全てのデータはこの端末内に保存されています。ネットワーク通信は行いません。
          </p>
          {dataPath ? (
            <p className="text-xs font-mono bg-muted rounded-lg px-3 py-2 text-muted-foreground mb-3 break-all">
              {dataPath}
            </p>
          ) : (
            <button
              onClick={async () => setDataPath(await api.getDataPath())}
              className="text-xs text-blue-500 hover:underline mb-3 block"
            >
              パスを表示
            </button>
          )}
          <button
            onClick={() => api.openDataFolder()}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            <FolderOpen size={13} />
            フォルダを開く
          </button>
        </div>

        {/* Export */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Download size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-sm">データのエクスポート</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            全データをJSONファイルとしてエクスポートします。
          </p>
          <button
            onClick={exportJson}
            disabled={exporting}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-foreground text-background hover:bg-foreground/80 transition-colors disabled:opacity-50"
          >
            <Download size={13} />
            {exporting ? "エクスポート中…" : "JSONでエクスポート"}
          </button>
        </div>

        {/* Version */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm mb-2">アプリ情報</h3>
          <dl className="space-y-1 text-xs text-muted-foreground">
            <div className="flex gap-2"><dt className="w-24 shrink-0">バージョン</dt><dd>0.1.0</dd></div>
            <div className="flex gap-2"><dt className="w-24 shrink-0">ストレージ</dt><dd>SQLite (ローカル)</dd></div>
            <div className="flex gap-2"><dt className="w-24 shrink-0">同期</dt><dd>なし (完全オフライン)</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}
