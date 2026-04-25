export type ThemeId =
  | "linear" | "ocean" | "braun" | "washi" | "terminal"
  | "things" | "newspaper" | "cyberpunk" | "y2k" | "pastel" | "dawn" | "crayon";

export type ColorMode = "light" | "dark" | "system";

export interface Theme {
  id: ThemeId;
  name: string;
  emoji: string;
  description: string;
  phase: 1 | 2 | 3;
}

export const THEMES: Theme[] = [
  { id: "linear",    name: "Linear",    emoji: "◼", description: "静謐・プロ仕様・集中",        phase: 1 },
  { id: "ocean",     name: "Ocean",     emoji: "🌊", description: "落ち着き・青系・集中",        phase: 2 },
  { id: "braun",     name: "Braun",     emoji: "🟠", description: "ドイツ工業デザイン・機能美",  phase: 2 },
  { id: "washi",     name: "Washi",     emoji: "📜", description: "和紙・墨・侘び寂び",          phase: 2 },
  { id: "terminal",  name: "Terminal",  emoji: "💻", description: "GitHub風・開発者向け",        phase: 2 },
  { id: "things",    name: "Things",    emoji: "🍎", description: "Apple的・ガラスモーフィズム",  phase: 2 },
  { id: "newspaper", name: "Newspaper", emoji: "📰", description: "エディトリアル・セリフ",       phase: 2 },
  { id: "cyberpunk", name: "Cyberpunk", emoji: "🌐", description: "テック・エッジ・ネオン",       phase: 3 },
  { id: "y2k",       name: "Y2K",       emoji: "💾", description: "90年代・レトロPC",             phase: 3 },
  { id: "pastel",    name: "Pastel",    emoji: "🌸", description: "やわらか・癒し・フェミニン",   phase: 3 },
  { id: "dawn",      name: "Dawn",      emoji: "🌅", description: "朝焼け・夕焼け・ロマンチック", phase: 3 },
  { id: "crayon",    name: "Crayon",    emoji: "🖍️", description: "子供っぽい・カラフル・自由",  phase: 3 },
];

export function applyTheme(id: ThemeId, mode: ColorMode) {
  const html = document.documentElement;
  html.setAttribute("data-theme", id);

  let resolvedMode = mode;
  if (mode === "system") {
    resolvedMode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  html.setAttribute("data-mode", resolvedMode);

  localStorage.setItem("sb-theme", id);
  localStorage.setItem("sb-color-mode", mode);
}

export function loadTheme(): ThemeId {
  return (localStorage.getItem("sb-theme") as ThemeId) ?? "linear";
}

export function loadColorMode(): ColorMode {
  return (localStorage.getItem("sb-color-mode") as ColorMode) ?? "light";
}

export function applyBackground(dataUrl: string | null) {
  const root = document.documentElement;
  if (dataUrl) {
    root.style.setProperty("--bg-image", `url("${dataUrl}")`);
    root.setAttribute("data-has-bg", "true");
  } else {
    root.style.removeProperty("--bg-image");
    root.removeAttribute("data-has-bg");
  }
}

export function loadBackground(): string | null {
  try { return localStorage.getItem("sb-bg-image"); } catch { return null; }
}

export function saveBackground(dataUrl: string | null) {
  try {
    if (dataUrl) localStorage.setItem("sb-bg-image", dataUrl);
    else localStorage.removeItem("sb-bg-image");
  } catch { /* quota */ }
}
