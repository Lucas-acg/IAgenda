import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

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
export interface HabitLog { id: string; name: string; kind: "recorrente" | "pontual"; date: string; time: string; note: string; }
export interface DailyReminder { id: string; name: string; time: string; active: boolean; }
export interface ImportantDay { id: string; name: string; date: string; notify: boolean; }
export interface Profile {
  name: string; height: string; weight: string; wake: string; sleep: string;
  waterGoal: number; sleepGoal: number;
}
export interface Prefs { notifications: boolean; weekStartsMonday: boolean; compact: boolean; }

export interface AppData {
  appointments: Appointment[]; entries: Entry[]; habits: HabitLog[];
  reminders: DailyReminder[]; importantDays: ImportantDay[]; profile: Profile; prefs: Prefs;
}

const KEY = "iagenda:v1";

export const defaultData = (): AppData => ({
  appointments: [], entries: [], habits: [],
  reminders: [
    { id: uid(), name: "Beber água", time: "10:00", active: true },
    { id: uid(), name: "Alongar", time: "16:00", active: false },
  ],
  importantDays: [],
  profile: { name: "", height: "", weight: "", wake: "07:00", sleep: "23:00", waterGoal: 8, sleepGoal: 8 },
  prefs: { notifications: false, weekStartsMonday: false, compact: false },
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
  data: AppData; ready: boolean;
  setData: (fn: (d: AppData) => AppData) => void;
  addAppointment: (a: Omit<Appointment, "id" | "done" | "createdAt">) => void;
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  removeAppointment: (id: string) => void;
  addEntry: (e: Omit<Entry, "id">) => void;
  removeEntry: (id: string) => void;
  addHabit: (h: Omit<HabitLog, "id">) => void;
  removeHabit: (id: string) => void;
  resetAll: () => void;
}
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setRaw] = useState<AppData>(defaultData);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppData>;
        const base = defaultData();
        setRaw({ ...base, ...parsed, profile: { ...base.profile, ...parsed.profile }, prefs: { ...base.prefs, ...parsed.prefs } });
      }
    } catch { /* dados corrompidos: começa do zero */ }
    setReady(true);
  }, []);

  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(data)); }, [data, ready]);

  const setData = useCallback((fn: (d: AppData) => AppData) => setRaw(fn), []);

  const value = useMemo<Ctx>(() => ({
    data, ready, setData,
    addAppointment: (a) => setRaw((d) => ({ ...d, appointments: [...d.appointments, { ...a, id: uid(), done: false, createdAt: new Date().toISOString() }] })),
    updateAppointment: (id, patch) => setRaw((d) => ({ ...d, appointments: d.appointments.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    removeAppointment: (id) => setRaw((d) => ({ ...d, appointments: d.appointments.filter((x) => x.id !== id) })),
    addEntry: (e) => setRaw((d) => ({ ...d, entries: [...d.entries, { ...e, id: uid() }] })),
    removeEntry: (id) => setRaw((d) => ({ ...d, entries: d.entries.filter((x) => x.id !== id) })),
    addHabit: (h) => setRaw((d) => ({ ...d, habits: [...d.habits, { ...h, id: uid() }] })),
    removeHabit: (id) => setRaw((d) => ({ ...d, habits: d.habits.filter((x) => x.id !== id) })),
    resetAll: () => setRaw(defaultData()),
  }), [data, ready, setData]);

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
