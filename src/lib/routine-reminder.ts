import { format } from "date-fns";
import { routineDue, type HabitRoutine } from "./habit-routines";

export function routineReminder(r: HabitRoutine, logs: { date: string; routine_id?: string | null | undefined }[], now: Date) {
  const date = format(now, "yyyy-MM-dd");
  if (!r.notify || !r.time || !routineDue(r, date) || logs.some((h) => h.routine_id === r.id && h.date === date)) return null;
  const [hour = 0, minute = 0] = r.time.split(":").map(Number);
  const when = new Date(now); when.setHours(hour, minute, 0, 0);
  const elapsed = now.getTime() - when.getTime();
  return elapsed >= 0 && elapsed < 10 * 60_000 ? { key: `routine-${r.id}-${date}-${r.time}` } : null;
}