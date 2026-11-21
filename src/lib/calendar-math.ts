import { addDays, getDaysInMonth, startOfWeek } from "date-fns";

export function monthCells(month: Date, weekStart: 0 | 1) {
  const offset = (month.getDay() - weekStart + 7) % 7;
  const count = Math.ceil((offset + getDaysInMonth(month)) / 7) * 7;
  const first = startOfWeek(month, { weekStartsOn: weekStart });
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}

export function appointmentHasPassed(a: { date: string; time: string }, now: Date) {
  return new Date(`${a.date}T${a.time}:00`).getTime() <= now.getTime();
}

export function appointmentNoticeKey(a: { id: string; date: string; time: string }, reminder = false) {
  return `a-${a.id}-${a.date}-${a.time}${reminder ? "-pre" : ""}`;
}