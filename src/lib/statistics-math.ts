import { addDays, differenceInCalendarDays, getDaysInMonth, startOfMonth, startOfWeek, subMonths, subWeeks } from "date-fns";

export function dailyWaterAverage(total: number, days: number) { return total / days; }

export function comparisonPeriods(now: Date, weekStartsOn: 0 | 1) {
  const weekStart = startOfWeek(now, { weekStartsOn });
  const weekDays = differenceInCalendarDays(now, weekStart) + 1;
  const monthStart = startOfMonth(now);
  const previousMonth = subMonths(monthStart, 1);
  const monthDays = Math.min(now.getDate(), getDaysInMonth(previousMonth));
  return {
    week: { current: weekStart, currentEnd: addDays(now, 1), previous: subWeeks(weekStart, 1), previousEnd: addDays(subWeeks(weekStart, 1), weekDays) },
    month: { current: monthStart, currentEnd: addDays(monthStart, monthDays), previous: previousMonth, previousEnd: addDays(previousMonth, monthDays) },
  };
}