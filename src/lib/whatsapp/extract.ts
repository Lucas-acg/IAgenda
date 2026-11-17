/** Pure helpers for WhatsApp → appointment extraction (safe for tests and the browser). */
export const CATEGORIES = ["trabalho", "saude", "estudos", "pessoal", "social", "outro"] as const;
export const LINK_CODE_LIFETIME_MS = 10 * 60_000;

export interface Extraction {
  is_appointment: boolean;
  title: string | null;
  date: string | null;
  time: string | null;
  category: (typeof CATEGORIES)[number] | null;
  description: string | null;
}

/** Local date/time/weekday for the user's timezone, used as the AI's "now". */
export function localNow(timezone: string, at = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at).map((p) => [p.type, p.value]),
  );
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, weekday: "long" }).format(at);
  return { date: `${parts["year"]}-${parts["month"]}-${parts["day"]}`, time: `${parts["hour"]}:${parts["minute"]}`, weekday };
}

/** Accepts an AI answer only when it is a real appointment with a valid date and a specific time. */
export function toAppointment(x: Extraction): { title: string; date: string; time: string; category: (typeof CATEGORIES)[number]; description: string } | null {
  if (!x.is_appointment || !x.title?.trim() || !x.date || !x.time) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time)) return null;
  const d = new Date(x.date + "T12:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== x.date) return null;
  return {
    title: x.title.trim().slice(0, 200),
    date: x.date,
    time: x.time,
    category: x.category && CATEGORIES.includes(x.category) ? x.category : "outro",
    description: (x.description ?? "").slice(0, 2000),
  };
}
