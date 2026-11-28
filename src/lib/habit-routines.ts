import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

export interface HabitRoutine {
  id: string;
  name: string;
  days: number[];
  active: boolean;
  time?: string | null | undefined;
  notify?: boolean | undefined;
}
export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const habitNameKey = (name: string) => name.trim().toLocaleLowerCase("pt-BR");
export const validHabitDate = (date: string, today: string) => date <= today;
export function routineDue(routine: HabitRoutine, date: string) {
  return routine.active && routine.days.includes(parseISO(date).getDay());
}

/** Today remains open; missed scheduled days break a streak, rest days never do. */
export function routineStreaks(
  routine: HabitRoutine,
  logs: { date: string; routine_id?: string | null | undefined }[],
  today: string,
) {
  const dates = new Set(
    logs.filter((h) => h.routine_id === routine.id && h.date <= today).map((h) => h.date),
  );
  const first = [...dates].sort()[0];
  if (!first || routine.days.length === 0) return { current: 0, best: 0 };
  let current = 0,
    best = 0;
  const end = parseISO(today),
    start = parseISO(first);
  const count = differenceInCalendarDays(end, start);
  for (let i = 0; i <= count; i++) {
    const day = addDays(start, i),
      iso = format(day, "yyyy-MM-dd");
    if (!routine.days.includes(day.getDay())) continue;
    if (dates.has(iso)) {
      current++;
      best = Math.max(best, current);
    } else if (iso !== today) current = 0;
  }
  return { current, best };
}

export function habitSuggestions(
  logs: { name: string; date: string; time: string }[],
  routines: HabitRoutine[],
  defaults: string[] = [],
) {
  const names = new Map<string, { name: string; count: number; recent: string }>();
  for (const h of logs) {
    const key = habitNameKey(h.name),
      recent = h.date + h.time,
      old = names.get(key);
    names.set(key, {
      name: !old || recent > old.recent ? h.name.trim() : old.name,
      count: (old?.count ?? 0) + 1,
      recent: recent > (old?.recent ?? "") ? recent : (old?.recent ?? ""),
    });
  }
  for (const name of [...routines.map((r) => r.name), ...defaults]) {
    const key = habitNameKey(name);
    if (!names.has(key)) names.set(key, { name: name.trim(), count: 0, recent: "" });
  }
  return [...names.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.recent.localeCompare(a.recent) ||
        a.name.localeCompare(b.name, "pt-BR"),
    )
    .map((h) => h.name);
}
