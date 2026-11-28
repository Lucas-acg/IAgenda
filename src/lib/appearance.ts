const LEGACY_COLORS = { menta: "#007d6b", rosa: "#b64466", azul: "#1f6cb0" };
export const APPEARANCE_KEY = "iagenda:appearance";

export interface AppearancePrefs {
  accentColor: string;
  theme: "claro" | "escuro" | "auto";
  largeText: boolean;
  animations: boolean;
  showSummary: boolean;
  calendarView: "mes" | "semana" | "ano";
}

export const DEFAULT_APPEARANCE: AppearancePrefs = {
  accentColor: "#007d6b", theme: "claro", largeText: false,
  animations: true, showSummary: true, calendarView: "mes",
};

type LooseAppearance = { [K in keyof AppearancePrefs]?: unknown } & { palette?: unknown };

export function normalizeAppearance(value: LooseAppearance = {}): AppearancePrefs {
  const legacy = typeof value.palette === "string" && value.palette in LEGACY_COLORS
    ? LEGACY_COLORS[value.palette as keyof typeof LEGACY_COLORS] : DEFAULT_APPEARANCE.accentColor;
  return {
    accentColor: typeof value.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(value.accentColor) ? value.accentColor.toLowerCase() : legacy,
    theme: value.theme === "escuro" || value.theme === "auto" ? value.theme : "claro",
    largeText: typeof value.largeText === "boolean" ? value.largeText : false,
    animations: typeof value.animations === "boolean" ? value.animations : true,
    showSummary: typeof value.showSummary === "boolean" ? value.showSummary : true,
    calendarView: value.calendarView === "semana" || value.calendarView === "ano" ? value.calendarView : "mes",
  };
}

export function accentForeground(hex: string) {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = (rgb[0] ?? 0) * 0.2126 + (rgb[1] ?? 0) * 0.7152 + (rgb[2] ?? 0) * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
}

export function applyAppearance(p: AppearancePrefs, systemDark: boolean) {
  const root = document.documentElement;
  const dark = p.theme === "escuro" || (p.theme === "auto" && systemDark);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  root.style.setProperty("--primary", p.accentColor);
  root.style.setProperty("--primary-foreground", accentForeground(p.accentColor));
  delete root.dataset["density"];
  root.dataset["text"] = p.largeText ? "large" : "standard";
  root.dataset["motion"] = p.animations ? "on" : "off";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#14191a" : p.accentColor);
}

// Runs before paint; the same contrast formula is used by live preferences.
export const APPEARANCE_BOOTSTRAP = `(()=>{try{const p=JSON.parse(localStorage.getItem('${APPEARANCE_KEY}')||'{}');const c=/^#[0-9a-fA-F]{6}$/.test(p.accentColor)?p.accentColor:'#007d6b';const d=p.theme==='escuro'||(p.theme==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);const r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';r.style.setProperty('--primary',c);const v=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);const l=v[0]*.2126+v[1]*.7152+v[2]*.0722;r.style.setProperty('--primary-foreground',(l+.05)/.05>=1.05/(l+.05)?'#000000':'#ffffff');r.dataset.text=p.largeText?'large':'standard';delete r.dataset.density;r.dataset.motion=p.animations===false?'off':'on';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',d?'#14191a':c)}catch{}})();`;