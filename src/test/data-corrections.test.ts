import { describe, expect, it } from "vitest";
import { differenceInCalendarDays } from "date-fns";
import { accentForeground, DEFAULT_APPEARANCE, normalizeAppearance } from "@/lib/appearance";
import { dateTimeSchema, entrySchema, habitSchema, validateBackup } from "@/lib/backup";
import { monthCells, appointmentHasPassed, appointmentNoticeKey } from "@/lib/calendar-math";
import { createPendingSave } from "@/lib/pending-save";
import { comparisonPeriods, dailyWaterAverage } from "@/lib/statistics-math";

describe("Regras de dados e aparência", () => {
  it("rejeita acontecimentos sem data ou horário", () => {
    const row = { id: "1", date: "2026-11-21", time: "14:00", type: "agua", note: "" };
    expect(entrySchema.safeParse(row).success).toBe(true);
    expect(entrySchema.safeParse({ ...row, date: "" }).success).toBe(false);
    expect(entrySchema.safeParse({ ...row, time: "" }).success).toBe(false);
  });
  it("rejeita hábitos sem data ou horário", () => {
    const row = { id: "1", date: "2026-11-21", time: "14:00", name: "Meditar", kind: "pontual", note: "" };
    expect(habitSchema.safeParse(row).success).toBe(true);
    expect(habitSchema.safeParse({ ...row, date: "" }).success).toBe(false);
    expect(habitSchema.safeParse({ ...row, time: "" }).success).toBe(false);
  });
  it("rejeita datas e horas inexistentes", () => {
    expect(dateTimeSchema.safeParse({ date: "2026-02-30", time: "14:00" }).success).toBe(false);
    expect(dateTimeSchema.safeParse({ date: "2026-11-21", time: "24:00" }).success).toBe(false);
  });
  it("inclui 30 de novembro de 2026 com semana iniciando segunda", () => {
    const cells = monthCells(new Date(2026, 10, 1), 1);
    expect(cells).toHaveLength(42);
    expect(cells[0]?.getDay()).toBe(1);
    expect(cells.some((d) => d.getMonth() === 10 && d.getDate() === 30)).toBe(true);
  });
  it("gera nova chave de aviso ao remarcar data ou hora", () => {
    const a = { id: "1", date: "2026-11-21", time: "14:00" };
    expect(appointmentNoticeKey(a)).not.toBe(appointmentNoticeKey({ ...a, time: "15:00" }));
    expect(appointmentNoticeKey(a, true)).not.toBe(appointmentNoticeKey({ ...a, date: "2026-11-22" }, true));
  });
  it("divide água pelos 30 dias do período mesmo com apenas um registro", () => {
    expect(dailyWaterAverage(6, 30)).toBe(0.2);
  });
  it("não conta compromissos cujo horário ainda não passou", () => {
    const now = new Date(2026, 10, 21, 14, 0);
    expect(appointmentHasPassed({ date: "2026-11-21", time: "13:59" }, now)).toBe(true);
    expect(appointmentHasPassed({ date: "2026-11-21", time: "14:01" }, now)).toBe(false);
    expect(appointmentHasPassed({ date: "2026-11-22", time: "09:00" }, now)).toBe(false);
  });
  it("compara semanas pelo mesmo número de dias decorridos", () => {
    const { week } = comparisonPeriods(new Date(2026, 10, 18), 1);
    expect(differenceInCalendarDays(week.currentEnd, week.current)).toBe(3);
    expect(differenceInCalendarDays(week.previousEnd, week.previous)).toBe(3);
  });
  it("compara meses pelo mesmo número de dias, inclusive após fevereiro", () => {
    const { month } = comparisonPeriods(new Date(2026, 2, 31), 0);
    expect(differenceInCalendarDays(month.currentEnd, month.current)).toBe(28);
    expect(differenceInCalendarDays(month.previousEnd, month.previous)).toBe(28);
  });
  it.each([["menta", "#007d6b"], ["rosa", "#b64466"], ["azul", "#1f6cb0"]])("converte a paleta antiga %s", (palette, hex) => {
    expect(normalizeAppearance({ palette }).accentColor).toBe(hex);
  });
  it("usa tema claro e cor padrão, rejeitando valores inválidos", () => {
    expect(normalizeAppearance({ theme: "inválido", accentColor: "red" })).toEqual(DEFAULT_APPEARANCE);
  });
  it("garante contraste de pelo menos 4,5 para qualquer cor RGB", () => {
    for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
      const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
      const [rr = 0, gg = 0, bb = 0] = [r, g, b].map((v) => v / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
      const l = rr * .2126 + gg * .7152 + bb * .0722;
      expect(accentForeground(hex) === "#ffffff" ? 1.05 / (l + .05) : (l + .05) / .05).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("valida e converte backups antigos sem conservar palette nas preferências", () => {
    const backup = { appointments: [], entries: [], habits: [], reminders: [], importantDays: [], profile: { name: "", height: "", weight: "", wake: "07:00", sleep: "23:00", waterGoal: 8, sleepGoal: 8 }, prefs: { notifications: false, weekStartsMonday: false, palette: "rosa" } };
    const restored = validateBackup(backup);
    expect(restored.prefs.accentColor).toBe("#b64466");
    expect(restored.prefs).not.toHaveProperty("palette");
  });
});

describe("Sincronização", () => {
  it("preserva edição feita durante salvamento e flush aguarda ambas", async () => {
    const resolvers: Array<() => void> = [];
    const saved: number[] = [];
    const queue = createPendingSave<number>((data) => { saved.push(data); return new Promise<void>((resolve) => resolvers.push(resolve)); });
    queue.edit(1);
    const flush = queue.flush();
    queue.edit(2);
    expect(queue.dirty).toBe(true);
    resolvers[0]?.();
    await Promise.resolve();
    expect(queue.dirty).toBe(true);
    expect(saved).toEqual([1, 2]);
    expect(queue.flush()).toBe(flush);
    resolvers[1]?.();
    await flush;
    expect(queue.dirty).toBe(false);
  });
  it("mantém pendência quando salvamento falha e permite tentar de novo", async () => {
    let fail = true;
    const queue = createPendingSave<number>(async () => { if (fail) throw new Error("offline"); });
    queue.edit(1);
    await expect(queue.flush()).rejects.toThrow("offline");
    expect(queue.dirty).toBe(true);
    fail = false;
    await queue.flush();
    expect(queue.dirty).toBe(false);
  });
});