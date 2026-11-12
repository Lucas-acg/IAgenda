import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { User, CalendarRange, CalendarDays, Cake, BellRing, SlidersHorizontal, ChevronRight, ChevronLeft, Plus, Trash2, Download, Upload } from "lucide-react";
import { addDays, format, startOfMonth, startOfWeek, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ENTRY_LABEL, appointmentStatus, toISODate, uid, useStore, type AppData, type EntryType } from "@/lib/store";
import { PageHeader } from "@/components/app/shared";
import { cn } from "@/lib/utils";
import { AppearanceSettings } from "@/components/app/appearance-settings";
import { normalizeAppearance } from "@/lib/appearance";
import { defaultData } from "@/lib/store";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — IAgenda" },
      { name: "description", content: "Perfil, relatórios, dias importantes, lembretes diários e preferências." },
      { property: "og:title", content: "Configurações — IAgenda" },
      { property: "og:description", content: "Perfil, relatórios, dias importantes, lembretes diários e preferências." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Configuracoes,
});

const SECTIONS = [
  { k: "perfil", l: "Perfil", d: "Nome, corpo, rotina e metas", icon: User },
  { k: "semanal", l: "Relatório semanal", d: "Resumo dos últimos 7 dias", icon: CalendarRange },
  { k: "mensal", l: "Relatório mensal", d: "Consolidação e padrões", icon: CalendarDays },
  { k: "dias", l: "Dias importantes", d: "Aniversários e datas anuais", icon: Cake },
  { k: "lembretes", l: "Eventos diários e lembretes", d: "Água, estudo, remédios…", icon: BellRing },
  { k: "preferencias", l: "Preferências", d: "Notificações, aparência e dados", icon: SlidersHorizontal },
] as const;
type Key = (typeof SECTIONS)[number]["k"];

function Configuracoes() {
  const [active, setActive] = useState<Key>("perfil");
  const [mobileOpen, setMobileOpen] = useState<Key | null>(null);
  const cur = SECTIONS.find((s) => s.k === (mobileOpen ?? active)) ?? SECTIONS[0];
  return (
    <div>
      {/* Mobile: list → dedicated screen */}
      <div className="md:hidden">
        {mobileOpen ? (
          <div className="fade-up">
            <Button variant="ghost" className="-ml-3 mb-2 h-11" onClick={() => setMobileOpen(null)}><ChevronLeft className="size-5" />Configurações</Button>
            <h1 className="mb-4 font-display text-2xl font-bold">{cur.l}</h1>
            <SectionBody k={mobileOpen} />
          </div>
        ) : (
          <>
            <PageHeader title="Configurações" />
            <ul className="card-soft divide-y overflow-hidden">
              {SECTIONS.map((s) => (
                <li key={s.k}><Button variant="ghost" onClick={() => setMobileOpen(s.k)} className="flex h-auto min-h-16 w-full justify-start gap-3 whitespace-normal rounded-none px-4 py-3 text-left active:bg-muted">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><s.icon className="size-5" aria-hidden /></span>
                  <span className="min-w-0 flex-1"><span className="block font-semibold">{s.l}</span><span className="block truncate text-sm text-muted-foreground">{s.d}</span></span>
                  <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                </Button></li>
              ))}
            </ul>
          </>
        )}
      </div>
      {/* Desktop: internal side menu */}
      <div className="hidden md:block">
        <PageHeader title="Configurações" subtitle="Personalize o IAgenda" />
        <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-5 xl:grid-cols-[230px_minmax(0,1fr)]">
          <nav aria-label="Seções" className="space-y-1">
            {SECTIONS.map((s) => (
              <Button variant="ghost" key={s.k} onClick={() => setActive(s.k)} aria-current={active === s.k ? "page" : undefined}
                className={cn("flex h-auto min-h-11 w-full justify-start gap-3 whitespace-normal rounded-xl px-3 py-3 text-left text-sm font-medium", active === s.k ? "bg-primary-soft text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
                <s.icon className="size-4" aria-hidden />{s.l}
              </Button>
            ))}
          </nav>
          <div className="min-w-0 border-l pl-5 xl:pl-8">
            <h2 className="font-display text-xl font-bold">{cur.l}</h2>
            <p className="mb-5 text-sm text-muted-foreground">{cur.d}</p>
            <SectionBody k={active} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionBody({ k }: { k: Key }) {
  if (k === "perfil") return <ProfileForm />;
  if (k === "semanal") return <Report kind="semanal" />;
  if (k === "mensal") return <Report kind="mensal" />;
  if (k === "dias") return <ImportantDays />;
  if (k === "lembretes") return <Reminders />;
  return <Preferences />;
}

function F({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
const inp = "h-11 rounded-xl";

function ProfileForm() {
  const { data, setData } = useStore();
  const p = data.profile;
  const set = (patch: Partial<AppData["profile"]>) => setData((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><F id="pf-name" label="Nome"><Input id="pf-name" className={inp} value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="Como quer ser chamado(a)" /></F></div>
      <F id="pf-h" label="Altura (cm) — opcional"><Input id="pf-h" inputMode="numeric" className={inp} value={p.height} onChange={(e) => set({ height: e.target.value })} /></F>
      <F id="pf-w" label="Peso (kg) — opcional"><Input id="pf-w" inputMode="decimal" className={inp} value={p.weight} onChange={(e) => set({ weight: e.target.value })} /></F>
      <F id="pf-wake" label="Costumo acordar às"><Input id="pf-wake" type="time" className={inp} value={p.wake} onChange={(e) => set({ wake: e.target.value })} /></F>
      <F id="pf-sleep" label="Costumo dormir às"><Input id="pf-sleep" type="time" className={inp} value={p.sleep} onChange={(e) => set({ sleep: e.target.value })} /></F>
      <F id="pf-water" label="Meta de água (copos/dia)"><Input id="pf-water" type="number" min={1} className={inp} value={p.waterGoal} onChange={(e) => set({ waterGoal: Number(e.target.value) || 1 })} /></F>
      <F id="pf-sg" label="Meta de sono (horas)"><Input id="pf-sg" type="number" min={1} step={0.5} className={inp} value={p.sleepGoal} onChange={(e) => set({ sleepGoal: Number(e.target.value) || 1 })} /></F>
      {p.weight && <p className="text-sm text-muted-foreground sm:col-span-2">Sugestão de hidratação pelo peso: ~{Math.round((Number(p.weight) * 35) / 250)} copos de 250 ml por dia.</p>}
      <p className="text-xs text-muted-foreground sm:col-span-2">Alterações são salvas automaticamente neste aparelho.</p>
    </div>
  );
}

function Report({ kind }: { kind: "semanal" | "mensal" }) {
  const { data } = useStore();
  const now = new Date();
  const from = kind === "semanal" ? addDays(now, -6) : startOfMonth(now);
  const to = kind === "semanal" ? now : endOfMonth(now);
  const a = toISODate(from), b = toISODate(to);
  const inR = (d: string) => d >= a && d <= b;
  const entries = data.entries.filter((e) => inR(e.date));
  const habits = data.habits.filter((h) => inR(h.date));
  const appts = data.appointments.filter((x) => inR(x.date));
  const done = appts.filter((x) => x.done).length;
  const missed = appts.filter((x) => appointmentStatus(x) === "expirado" || appointmentStatus(x) === "atrasado").length;
  const sleep = entries.filter((e) => e.type === "sono" && e.value);
  const avgSleep = sleep.length ? sleep.reduce((s, e) => s + (e.value ?? 0), 0) / sleep.length : null;
  const badSleep = sleep.filter((e) => e.quality === "ruim").length;
  const waterByDay = entries.filter((e) => e.type === "agua").reduce<Record<string, number>>((m, e) => ((m[e.date] = (m[e.date] ?? 0) + (e.value ?? 1)), m), {});
  const goalDays = Object.values(waterByDay).filter((v) => v >= data.profile.waterGoal).length;
  const topHabit = Object.entries(habits.reduce<Record<string, number>>((m, h) => ((m[h.name] = (m[h.name] ?? 0) + 1), m), {})).sort((x, y) => y[1] - x[1])[0];
  const weekdayCount = [...entries, ...habits].reduce<Record<number, number>>((m, e) => { const wd = new Date(e.date + "T12:00").getDay(); m[wd] = (m[wd] ?? 0) + 1; return m; }, {});
  const busiest = Object.entries(weekdayCount).sort((x, y) => y[1] - x[1])[0];
  const typeCounts = (Object.keys(ENTRY_LABEL) as EntryType[]).map((t) => [ENTRY_LABEL[t], entries.filter((e) => e.type === t).length] as const);

  const patterns: string[] = [];
  if (avgSleep !== null) patterns.push(avgSleep < data.profile.sleepGoal ? `Você dormiu em média ${avgSleep.toFixed(1)}h, abaixo da meta de ${data.profile.sleepGoal}h.` : `Sono em dia: média de ${avgSleep.toFixed(1)}h.`);
  if (badSleep) patterns.push(`${badSleep} noite(s) de sono ruim registradas.`);
  if (Object.keys(waterByDay).length) patterns.push(`Meta de água batida em ${goalDays} de ${Object.keys(waterByDay).length} dia(s) registrados.`);
  if (topHabit) patterns.push(`Hábito mais constante: ${topHabit[0]} (${topHabit[1]}x).`);
  if (kind === "mensal" && busiest) patterns.push(`Dia da semana mais ativo: ${format(addDays(startOfWeek(now), Number(busiest[0])), "EEEE", { locale: ptBR })}.`);
  if (missed) patterns.push(`${missed} compromisso(s) passaram sem ser concluídos.`);

  return (
    <div className="space-y-5">
      <p className="text-sm capitalize text-muted-foreground">{format(from, "d MMM", { locale: ptBR })} – {format(to, "d MMM yyyy", { locale: ptBR })}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Compromissos", `${done}/${appts.length}`, "concluídos"], ["Acontecimentos", String(entries.length), "registrados"], ["Hábitos", String(habits.length), "realizados"], ["Sono médio", avgSleep ? `${avgSleep.toFixed(1)}h` : "–", `meta ${data.profile.sleepGoal}h`]].map(([l, v, h]) => (
          <div key={l} className="rounded-2xl bg-muted p-4"><p className="text-sm text-muted-foreground">{l}</p><p className="font-display text-2xl font-bold">{v}</p><p className="text-xs text-muted-foreground">{h}</p></div>
        ))}
      </div>
      <div><h3 className="mb-2 font-semibold">Atividades</h3>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">{typeCounts.map(([l, n]) => <li key={l} className="flex justify-between rounded-lg border px-3 py-2"><span>{l}</span><b>{n}</b></li>)}</ul>
      </div>
      <div><h3 className="mb-2 font-semibold">{kind === "mensal" ? "Padrões identificados" : "Destaques"}</h3>
        {patterns.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{patterns.map((p) => <li key={p}>{p}</li>)}</ul> : <p className="text-sm text-muted-foreground">Ainda não há registros suficientes neste período.</p>}
      </div>
    </div>
  );
}

function ImportantDays() {
  const { data, setData } = useStore();
  const [f, setF] = useState({ name: "", date: "" });
  const sorted = [...data.importantDays].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="space-y-5">
      <form className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end" onSubmit={(e) => {
        e.preventDefault();
        if (!f.name.trim() || !f.date) { toast.error("Preencha nome e data."); return; }
        setData((d) => ({ ...d, importantDays: [...d.importantDays, { id: uid(), name: f.name.trim(), date: f.date.slice(5), notify: true }] }));
        setF({ name: "", date: "" }); toast.success("Dia importante salvo");
      }}>
        <F id="id-name" label="Nome"><Input id="id-name" className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Aniversário da Ana" /></F>
        <F id="id-date" label="Data"><Input id="id-date" type="date" className={inp} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></F>
        <Button type="submit" className="h-11 rounded-xl"><Plus className="size-4" />Adicionar</Button>
      </form>
      <p className="text-xs text-muted-foreground">Repete todo ano no mesmo dia.</p>
      {sorted.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum dia importante ainda.</p> : (
        <ul className="space-y-2">{sorted.map((d) => (
          <li key={d.id} className="flex items-center gap-3 rounded-2xl border p-3">
            <span className="grid size-11 place-items-center rounded-xl bg-accent text-sm font-bold text-accent-foreground">{d.date.slice(3)}/{d.date.slice(0, 2)}</span>
            <span className="flex-1 font-medium">{d.name}</span>
            <Label htmlFor={`n-${d.id}`} className="sr-only">Notificar</Label>
            <Switch id={`n-${d.id}`} checked={d.notify} onCheckedChange={(v) => setData((x) => ({ ...x, importantDays: x.importantDays.map((y) => (y.id === d.id ? { ...y, notify: v } : y)) }))} />
            <Button size="icon" variant="ghost" className="size-11 rounded-xl" aria-label="Excluir" onClick={() => setData((x) => ({ ...x, importantDays: x.importantDays.filter((y) => y.id !== d.id) }))}><Trash2 className="size-4" /></Button>
          </li>))}
        </ul>
      )}
    </div>
  );
}

function Reminders() {
  const { data, setData } = useStore();
  const [f, setF] = useState({ name: "", time: "08:00" });
  return (
    <div className="space-y-5">
      <form className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end" onSubmit={(e) => {
        e.preventDefault(); if (!f.name.trim()) { toast.error("Dê um nome ao lembrete."); return; }
        setData((d) => ({ ...d, reminders: [...d.reminders, { id: uid(), name: f.name.trim(), time: f.time, active: true }] }));
        setF({ name: "", time: "08:00" }); toast.success("Lembrete criado");
      }}>
        <F id="rm-name" label="Atividade"><Input id="rm-name" className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Tomar vitamina" /></F>
        <F id="rm-time" label="Horário"><Input id="rm-time" type="time" className={inp} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></F>
        <Button type="submit" className="h-11 rounded-xl"><Plus className="size-4" />Adicionar</Button>
      </form>
      <ul className="space-y-2">{[...data.reminders].sort((a, b) => a.time.localeCompare(b.time)).map((r) => (
        <li key={r.id} className="flex items-center gap-3 rounded-2xl border p-3">
          <span className="w-14 font-display font-bold text-primary">{r.time}</span>
          <span className="flex-1 font-medium">{r.name}</span>
          <Label htmlFor={`r-${r.id}`} className="sr-only">Ativo</Label>
          <Switch id={`r-${r.id}`} checked={r.active} onCheckedChange={(v) => setData((x) => ({ ...x, reminders: x.reminders.map((y) => (y.id === r.id ? { ...y, active: v } : y)) }))} />
          <Button size="icon" variant="ghost" className="size-11 rounded-xl" aria-label="Excluir" onClick={() => setData((x) => ({ ...x, reminders: x.reminders.filter((y) => y.id !== r.id) }))}><Trash2 className="size-4" /></Button>
        </li>))}
      </ul>
      {!data.prefs.notifications && <p className="text-sm text-muted-foreground">Ative as notificações em Preferências para receber os avisos.</p>}
    </div>
  );
}

function Preferences() {
  const { data, setData, resetAll } = useStore();
  const setP = (patch: Partial<AppData["prefs"]>) => setData((d) => ({ ...d, prefs: { ...d.prefs, ...patch } }));
  const toggleNotif = async (v: boolean) => {
    if (v) {
      if (typeof Notification === "undefined") { toast.error("Este navegador não suporta notificações."); return; }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast.error("Permissão de notificação negada."); return; }
      toast.success("Notificações ativadas");
    }
    setP({ notifications: v });
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `iagenda-backup-${toISODate(new Date())}.json`; a.click(); URL.revokeObjectURL(url);
  };
  const importData = (file: File) => file.text().then((t) => { try { const parsed = JSON.parse(t) as Partial<AppData>; if (!Array.isArray(parsed.appointments) || !Array.isArray(parsed.entries) || !Array.isArray(parsed.habits) || !Array.isArray(parsed.reminders) || !Array.isArray(parsed.importantDays)) throw new Error(); const base = defaultData(); setData(() => ({ ...base, ...parsed, profile: { ...base.profile, ...parsed.profile }, prefs: { ...base.prefs, ...parsed.prefs, ...normalizeAppearance(parsed.prefs) } })); toast.success("Backup restaurado"); } catch { toast.error("Arquivo de backup inválido."); } });
  const Row = ({ id, title, desc, children }: { id: string; title: string; desc: string; children: ReactNode }) => (
    <div className="flex items-center justify-between gap-4 border-b py-4"><div className="min-w-0"><Label htmlFor={id} className="font-semibold">{title}</Label><p className="text-sm text-muted-foreground">{desc}</p></div><div className="shrink-0">{children}</div></div>
  );
  return (
    <div className="space-y-3">
      <Row id="pr-notif" title="Notificações" desc="Avisos de lembretes enquanto o app estiver aberto."><Switch id="pr-notif" checked={data.prefs.notifications} onCheckedChange={toggleNotif} /></Row>
      <Row id="pr-week" title="Semana começa na segunda" desc="Afeta calendário e comparações semanais."><Switch id="pr-week" checked={data.prefs.weekStartsMonday} onCheckedChange={(v) => setP({ weekStartsMonday: v })} /></Row>
      <div className="py-4"><AppearanceSettings /></div>
      <div className="grid gap-2 pt-2 sm:grid-cols-3">
        <Button variant="outline" className="h-11 rounded-xl" onClick={exportData}><Download className="size-4" />Exportar backup</Button>
        <Button variant="outline" className="h-11 rounded-xl" asChild>
          <label htmlFor="pr-import" className="cursor-pointer"><Upload className="size-4" />Importar backup<input id="pr-import" type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} /></label>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="outline" className="h-11 rounded-xl text-destructive hover:text-destructive"><Trash2 className="size-4" />Apagar tudo</Button></AlertDialogTrigger>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader><AlertDialogTitle>Apagar todos os dados?</AlertDialogTitle><AlertDialogDescription>Compromissos, registros e configurações deste aparelho serão removidos. Faça um backup antes.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel className="h-11 rounded-xl">Cancelar</AlertDialogCancel><AlertDialogAction className="h-11 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { resetAll(); toast.success("Dados apagados"); }}>Apagar</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <p className="pt-2 text-xs text-muted-foreground">Seus dados ficam guardados apenas neste aparelho/navegador.</p>
    </div>
  );
}
