export const PALETTES = [
  { value: "menta", label: "Menta", swatch: "bg-palette-mint" },
  { value: "rosa", label: "Rosa", swatch: "bg-palette-rose" },
  { value: "azul", label: "Azul", swatch: "bg-palette-blue" },
] as const;

export interface AppearancePrefs {
  palette: (typeof PALETTES)[number]["value"];
  compact: boolean;
  largeText: boolean;
  animations: boolean;
  showSummary: boolean;
  calendarView: "mes" | "semana";
}

export const DEFAULT_APPEARANCE: AppearancePrefs = {
  palette: "menta", compact: false, largeText: false,
  animations: true, showSummary: true, calendarView: "mes",
};

type LooseAppearance = { [K in keyof AppearancePrefs]?: unknown };

export function normalizeAppearance(value: LooseAppearance = {}): AppearancePrefs {
  const palette = PALETTES.find((p) => p.value === value.palette)?.value;
  return {
    palette: palette ?? "menta",
    compact: typeof value.compact === "boolean" ? value.compact : false,
    largeText: typeof value.largeText === "boolean" ? value.largeText : false,
    animations: typeof value.animations === "boolean" ? value.animations : true,
    showSummary: typeof value.showSummary === "boolean" ? value.showSummary : true,
    calendarView: value.calendarView === "semana" ? "semana" : "mes",
  };
}