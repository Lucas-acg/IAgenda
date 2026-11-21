import { z } from "zod";
import { normalizeAppearance } from "./appearance";
import type { AppData } from "./store";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => { const d = new Date(s + "T12:00:00Z"); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const id = z.string().min(1).max(200);
const text = z.string().max(10000);
const record = { id, date, time };
export const entrySchema = z.object({ ...record, type: z.enum(["sono","alimentacao","exercicio","agua","outro"]), note: text, value: z.number().finite().optional(), quality: z.enum(["ruim","ok","boa"]).optional() });
export const habitSchema = z.object({ ...record, name: text.trim().min(1), kind: z.enum(["recorrente","pontual"]), note: text });
export const dateTimeSchema = z.object({ date, time });
const schema = z.object({
  appointments: z.array(z.object({ ...record, title: text.min(1), description: text, category: z.enum(["trabalho","saude","estudos","pessoal","social","outro"]), reminder: z.number().int().nonnegative(), done: z.boolean(), createdAt: z.string().datetime({ offset: true }) })),
  entries: z.array(entrySchema),
  habits: z.array(habitSchema),
  reminders: z.array(z.object({ id, name: text.min(1), time, active: z.boolean() })),
  importantDays: z.array(z.object({ id, name: text.min(1), date: z.string().regex(/^\d{2}-\d{2}$/).refine((s) => { const d = new Date(`2000-${s}T12:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(5,10) === s; }), notify: z.boolean() })),
  profile: z.object({ name: text, timezone: z.string().default("America/Sao_Paulo").refine((s) => { try { new Intl.DateTimeFormat("pt-BR", { timeZone:s }); return true; } catch { return false; } }), height:text,weight:text,wake:time,sleep:time,waterGoal:z.number().positive(),sleepGoal:z.number().positive() }),
  prefs: z.object({ notifications:z.boolean(), weekStartsMonday:z.boolean(), compact:z.boolean().optional(), palette:z.enum(["menta","rosa","azul"]).optional(), accentColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), theme:z.enum(["claro","escuro","auto"]).optional(), largeText:z.boolean().optional(), animations:z.boolean().optional(), showSummary:z.boolean().optional(), calendarView:z.enum(["mes","semana"]).optional() }),
});
export function validateBackup(input: unknown): AppData {
  const data = schema.parse(input);
  for (const rows of [data.appointments,data.entries,data.habits,data.reminders,data.importantDays]) {
    if (new Set(rows.map((r) => r.id)).size !== rows.length) throw new Error("Registros duplicados");
  }
  const { palette: _legacy, ...prefs } = data.prefs;
  return { ...data, prefs: { ...prefs, ...normalizeAppearance(data.prefs) } };
}