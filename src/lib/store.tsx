import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRef } from "react";
import { toast } from "sonner";
import { DEFAULT_APPEARANCE, normalizeAppearance, type AppearancePrefs } from "./appearance";
import { useAuth } from "@/components/app/auth-provider";
import { acceptCloudData, loadCloudData, markImportOffered, saveCloudData } from "./cloud-store";
import { entrySchema, habitSchema, habitRoutineSchema, validateBackup } from "./backup";
import { createPendingSave } from "./pending-save";
import { habitNameKey, routineDue, validHabitDate, type HabitRoutine } from "./habit-routines";
export type { HabitRoutine } from "./habit-routines";

export type Category = "trabalho" | "saude" | "estudos" | "pessoal" | "social" | "outro";
export type EntryType = "sono" | "alimentacao" | "exercicio" | "agua" | "outro";
export type AppointmentStatus = "futuro" | "concluido" | "atrasado" | "expirado";

export interface Appointment {
  id: string; title: string; date: string; time: string; description: string;
  category: Category; reminder: number; done: boolean; createdAt: string;
}
export interface Entry {
  id: string; type: EntryType; date: string; time: string; note: string;
  value?: number | undefined; quality?: "ruim" | "ok" | "boa" | undefined;
}
export interface HabitLog { id: string; name: string; kind: "recorrente" | "pontual"; date: string; time: string; note: string; routine_id?: string | null | undefined; }
export interface DailyReminder { id: string; name: string; time: string; active: boolean; }
export interface ImportantDay { id: string; name: string; date: string; notify: boolean; }
export interface Profile {
  name: string; avatarPath: string; height: string; weight: string; wake: string; sleep: string;
  waterGoal: number; sleepGoal: number;
}
export interface Prefs extends AppearancePrefs { notifications: boolean; weekStartsMonday: boolean; }

export interface AppData {
  appointments: Appointment[]; entries: Entry[]; habits: HabitLog[]; habitRoutines: HabitRoutine[];
  reminders: DailyReminder[]; importantDays: ImportantDay[]; profile: Profile; prefs: Prefs;
}

const KEY = "iagenda:v1";

export const defaultData = (): AppData => ({
  appointments: [], entries: [], habits: [], habitRoutines: [],
  reminders: [
    { id: uid(), name: "Beber água", time: "10:00", active: true },
    { id: uid(), name: "Alongar", time: "16:00", active: false },
  ],
  importantDays: [],
  profile: { name: "", avatarPath: "", height: "", weight: "", wake: "07:00", sleep: "23:00", waterGoal: 8, sleepGoal: 8 },
  prefs: { notifications: false, weekStartsMonday: false, ...DEFAULT_APPEARANCE },
});

export function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

export function toISODate(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function parseISODate(s: string) { const [y = 1970, m = 1, d = 1] = s.split("-").map(Number); return new Date(y, m - 1, d); }
export function nowTime() { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }

/** Status rule: done → concluído; future → futuro; past by up to 24h → atrasado; older → expirado. */
export function appointmentStatus(a: Pick<Appointment, "date" | "time" | "done">, now = new Date()): AppointmentStatus {
  if (a.done) return "concluido";
  const [h = 23, m = 59] = (a.time || "23:59").split(":").map(Number);
  const when = parseISODate(a.date); when.setHours(h, m, 0, 0);
  const diff = now.getTime() - when.getTime();
  if (diff < 0) return "futuro";
  if (diff <= 24 * 3600 * 1000) return "atrasado";
  return "expirado";
}

export const CATEGORY_LABEL: Record<Category, string> = {
  trabalho: "Trabalho", saude: "Saúde", estudos: "Estudos", pessoal: "Pessoal", social: "Social", outro: "Outro",
};
export const ENTRY_LABEL: Record<EntryType, string> = {
  sono: "Sono", alimentacao: "Alimentação", exercicio: "Exercício", agua: "Água", outro: "Outro",
};
export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  futuro: "Futuro", concluido: "Concluído", atrasado: "Atrasado", expirado: "Expirado",
};

interface Ctx {
  data: AppData; ready: boolean; loadError: boolean;
  flush: () => Promise<void>;
  setData: (fn: (d: AppData) => AppData) => void;
  addAppointment: (a: Omit<Appointment, "id" | "done" | "createdAt">) => void;
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  removeAppointment: (id: string) => void;
  addEntry: (e: Omit<Entry, "id">) => boolean;
  removeEntry: (id: string) => void;
  addHabit: (h: Omit<HabitLog, "id">) => boolean;
  removeHabit: (id: string) => void;
  saveRoutine: (r: Omit<HabitRoutine, "id">, id?: string) => boolean;
  removeRoutine: (id: string) => void;
  toggleRoutine: (id: string, date: string) => void;
  resetAll: () => void;
  /** Re-reads data from the cloud (e.g. after appointments created from WhatsApp). */
  reload: () => void;
}
const StoreCtx = createContext<Ctx | null>(null);

/** Reads the pre-account localStorage data, if any, so it can be offered for import once. */
function readLegacy(): AppData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const base = defaultData();
    return validateBackup({ ...base, ...parsed, profile: { ...base.profile, ...parsed.profile }, prefs: { ...base.prefs, ...parsed.prefs, ...normalizeAppearance(parsed.prefs) } });
  } catch { return null; }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [data, setRaw] = useState<AppData>(defaultData);
  const [ready, setReady] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const latest = useRef(data);
  const queue = useMemo(() => createPendingSave<AppData>(saveCloudData), [userId]);
  const update = useCallback((fn: (d: AppData) => AppData) => {
    if (!ready || loadedFor.current !== userId) return;
    const next = fn(latest.current);
    latest.current = next; queue.edit(next); setRaw(next);
  }, [queue, ready, userId]);
  const applyCloud = useCallback((cloud: AppData) => {
    latest.current = cloud; acceptCloudData(cloud); setRaw(cloud);
  }, []);

  // Load the signed-in user's data from the cloud; offer the old device data once.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    setReady(false); setLoadError(false); loadedFor.current = null;
    loadCloudData(userId).then(({ data: cloud, importOffered }) => {
      if (!active) return;
      applyCloud(cloud); loadedFor.current = userId; setReady(true);
      const legacy = readLegacy();
      if (legacy && !importOffered && (legacy.appointments.length || legacy.entries.length || legacy.habits.length)) {
        void markImportOffered(userId).catch(() => {});
        toast("Encontramos dados salvos neste aparelho", {
          description: "Quer trazê-los para a sua conta? Seus registros atuais serão mantidos.",
          duration: 20000,
          action: { label: "Importar", onClick: () => {
            const d = latest.current;
            const next = { ...d,
              appointments: [...d.appointments, ...legacy.appointments.filter((x) => !d.appointments.some((y) => y.id === x.id))],
              entries: [...d.entries, ...legacy.entries.filter((x) => !d.entries.some((y) => y.id === x.id))],
              habits: [...d.habits, ...legacy.habits.filter((x) => !d.habits.some((y) => y.id === x.id))],
               habitRoutines: [...d.habitRoutines, ...legacy.habitRoutines.filter((x) => !d.habitRoutines.some((y) => y.id === x.id || habitNameKey(y.name) === habitNameKey(x.name)))],
              importantDays: [...d.importantDays, ...legacy.importantDays.filter((x) => !d.importantDays.some((y) => y.id === x.id))],
            };
            latest.current = next; queue.edit(next); setRaw(next);
            toast.success("Dados importados");
          } },
        });
      }
    }).catch(() => {
      if (active) setLoadError(true);
    });
    return () => { active = false; };
  }, [userId, loadAttempt, queue, applyCloud]);

  // Optimistic local state; debounced save to the cloud with a visible error.
  useEffect(() => {
    if (!ready || !userId || loadedFor.current !== userId || !queue.dirty) return;
    const t = setTimeout(() => {
      void queue.flush().catch(() => toast.error("Não foi possível salvar. Suas últimas alterações podem não ter sido gravadas."));
    }, 600);
    const flush = () => { void queue.flush().catch(() => {}); };
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush); document.addEventListener("visibilitychange", onHide);
    return () => { clearTimeout(t); window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", onHide); };
  }, [data, ready, userId, queue]);

  const setData = update;
  const refresh = useCallback(() => {
    if (!userId || queue.dirty || queue.saving) return;
    const revision = queue.revision;
    void loadCloudData(userId).then(({ data: cloud }) => {
      if (!queue.dirty && !queue.saving && queue.revision === revision && loadedFor.current === userId) applyCloud(cloud);
    }).catch(() => toast.error("Não foi possível atualizar seus dados."));
  }, [userId, queue, applyCloud]);
  useEffect(() => {
    if (!ready || !userId) return;
    const poll = () => { if (document.visibilityState === "visible") refresh(); };
    const interval = window.setInterval(poll, 15000);
    window.addEventListener("focus", poll);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", poll); };
  }, [ready, userId, refresh]);

  const value = useMemo<Ctx>(() => ({
    data, ready, loadError, setData, flush: () => queue.flush(),
    addAppointment: (a) => update((d) => ({ ...d, appointments: [...d.appointments, { ...a, id: uid(), done: false, createdAt: new Date().toISOString() }] })),
    updateAppointment: (id, patch) => update((d) => ({ ...d, appointments: d.appointments.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    removeAppointment: (id) => update((d) => ({ ...d, appointments: d.appointments.filter((x) => x.id !== id) })),
    addEntry: (e) => {
      const parsed = entrySchema.safeParse({ ...e, id: uid() });
      if (!ready || !parsed.success) { toast.error("Informe data, horário e valores válidos."); return false; }
      update((d) => ({ ...d, entries: [...d.entries, parsed.data] })); return true;
    },
    removeEntry: (id) => update((d) => ({ ...d, entries: d.entries.filter((x) => x.id !== id) })),
    addHabit: (h) => {
      const parsed = habitSchema.safeParse({ ...h, id: uid() });
      if (!ready || !parsed.success || !validHabitDate(h.date, toISODate(new Date())) || (h.routine_id && !latest.current.habitRoutines.some((r) => r.id === h.routine_id))) { toast.error("Informe nome, data e horário válidos, sem data futura."); return false; }
      update((d) => ({ ...d, habits: [...d.habits, parsed.data] })); return true;
    },
    removeHabit: (id) => update((d) => ({ ...d, habits: d.habits.filter((x) => x.id !== id) })),
    saveRoutine: (r, id) => {
      const parsed = habitRoutineSchema.safeParse({ ...r, id: id ?? uid() });
      if (!ready || !parsed.success) { toast.error("Informe o nome e ao menos um dia da semana."); return false; }
      if (latest.current.habitRoutines.some((x) => x.id !== id && habitNameKey(x.name) === habitNameKey(parsed.data.name))) { toast.error("Já existe uma rotina com esse nome."); return false; }
      update((d) => ({ ...d, habitRoutines: id ? d.habitRoutines.map((x) => x.id === id ? parsed.data : x) : [...d.habitRoutines, parsed.data] }));
      return true;
    },
    removeRoutine: (id) => update((d) => ({ ...d, habitRoutines: d.habitRoutines.filter((r) => r.id !== id), habits: d.habits.map((h) => h.routine_id === id ? { ...h, routine_id: null } : h) })),
    toggleRoutine: (id, date) => update((d) => {
      const r = d.habitRoutines.find((x) => x.id === id);
      if (!r || !validHabitDate(date, toISODate(new Date())) || !routineDue(r, date)) return d;
      const done = d.habits.some((h) => h.routine_id === id && h.date === date);
      return { ...d, habits: done ? d.habits.filter((h) => !(h.routine_id === id && h.date === date)) : [...d.habits, { id: uid(), name: r.name, kind: "recorrente", date, time: nowTime(), note: "", routine_id: id }] };
    }),
    resetAll: () => update(() => defaultData()),
    reload: () => { if (!ready) setLoadAttempt((n) => n + 1); else refresh(); },
  }), [data, ready, loadError, queue, setData, update, refresh]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore fora do StoreProvider");
  return c;
}

/** All records (entries + habits + appointments) for a given date. */
export function recordsOn(data: AppData, date: string) {
  return {
    appointments: data.appointments.filter((a) => a.date === date).sort((a, b) => a.time.localeCompare(b.time)),
    entries: data.entries.filter((e) => e.date === date).sort((a, b) => a.time.localeCompare(b.time)),
    habits: data.habits.filter((h) => h.date === date).sort((a, b) => a.time.localeCompare(b.time)),
  };
}
export function activityCount(data: AppData, date: string) {
  const r = recordsOn(data, date);
  return r.appointments.length + r.entries.length + r.habits.length;
}
