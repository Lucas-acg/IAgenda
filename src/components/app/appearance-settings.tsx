import { Check, Palette, RotateCcw, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_APPEARANCE, PALETTES } from "@/lib/appearance";
import { useStore, type Prefs } from "@/lib/store";
import { cn } from "@/lib/utils";

export function AppearanceSettings() {
  const { data, setData } = useStore();
  const p = data.prefs;
  const set = (patch: Partial<Prefs>) => setData((d) => ({ ...d, prefs: { ...d.prefs, ...patch } }));
  return (
    <section className="space-y-5" aria-labelledby="appearance-title">
      <div className="flex items-center justify-between gap-3">
        <h3 id="appearance-title" className="flex items-center gap-2 font-display text-lg font-semibold"><Palette className="size-5 text-primary" />Aparência</h3>
        <Button variant="ghost" size="icon" className="size-11 shrink-0" title="Restaurar aparência padrão" aria-label="Restaurar aparência padrão" onClick={() => set(DEFAULT_APPEARANCE)}><RotateCcw /></Button>
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Cor de destaque</legend>
        <div className="flex flex-wrap gap-3">
          {PALETTES.map((color) => (
            <Button key={color.value} variant="outline" className={cn("h-12 gap-2 rounded-xl px-3", p.palette === color.value && "border-primary bg-primary-soft text-sidebar-accent-foreground")} aria-pressed={p.palette === color.value} onClick={() => set({ palette: color.value })}>
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-primary-foreground", color.swatch)}>{p.palette === color.value && <Check className="size-3.5" />}</span>{color.label}
            </Button>
          ))}
        </div>
      </fieldset>
      <div className="divide-y border-y">
        <AppearanceToggle id="appearance-compact" label="Espaçamento compacto" checked={p.compact} onChange={(v) => set({ compact: v })} />
        <AppearanceToggle id="appearance-text" label="Texto ampliado" checked={p.largeText} onChange={(v) => set({ largeText: v })} />
        <AppearanceToggle id="appearance-motion" label="Animações suaves" checked={p.animations} onChange={(v) => set({ animations: v })} />
        <AppearanceToggle id="appearance-summary" label="Resumo na aba Compromissos" checked={p.showSummary} onChange={(v) => set({ showSummary: v })} />
      </div>
      <fieldset>
        <legend className="mb-2 flex items-center gap-2 text-sm font-medium"><CalendarDays className="size-4 text-primary" />Calendário ao abrir</legend>
        <div className="segmented-control inline-flex rounded-xl bg-muted p-1">
          {(["mes", "semana"] as const).map((v) => <Button key={v} variant="ghost" aria-pressed={p.calendarView === v} className={cn("h-11 rounded-lg px-5", p.calendarView === v ? "bg-card text-foreground shadow-sm hover:bg-card" : "text-muted-foreground")} onClick={() => set({ calendarView: v })}>{v === "mes" ? "Mês" : "Semana"}</Button>)}
        </div>
      </fieldset>
    </section>
  );
}

function AppearanceToggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <div className="flex min-h-14 items-center justify-between gap-4 py-3"><Label htmlFor={id} className="min-w-0 flex-1 leading-relaxed">{label}</Label><Switch id={id} className="shrink-0" checked={checked} onCheckedChange={onChange} /></div>;
}