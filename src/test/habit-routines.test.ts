import { describe, expect, it } from "vitest";
import { ALL_WEEKDAYS, habitNameKey, habitSuggestions, routineDue, routineStreaks, validHabitDate } from "@/lib/habit-routines";
import { habitRoutineSchema, validateBackup } from "@/lib/backup";
import { PHOTO_MAX_BYTES, validProfilePhoto } from "@/lib/profile-photo";

const routine = { id: "meditar", name: "Meditar", days: [1, 3, 5], active: true };
const log = (date: string) => ({ date, routine_id: routine.id });
const backup = { appointments: [], entries: [], habits: [], reminders: [], importantDays: [], profile: { name: "", height: "", weight: "", wake: "07:00", sleep: "23:00", waterGoal: 8, sleepGoal: 8 }, prefs: { notifications: false, weekStartsMonday: false } };

describe("Hábitos recorrentes", () => {
  it("padrão diário inclui todos os dias de 0 a 6", () => expect(ALL_WEEKDAYS).toEqual([0, 1, 2, 3, 4, 5, 6]));
  it("só mostra rotinas ativas nos dias programados", () => {
    expect(routineDue(routine, "2026-11-23")).toBe(true);
    expect(routineDue(routine, "2026-11-24")).toBe(false);
    expect(routineDue({ ...routine, active: false }, "2026-11-23")).toBe(false);
  });
  it("rejeita dia fora de 0-6, vazio ou repetido", () => {
    for (const days of [[], [-1], [7], [1, 1]]) expect(habitRoutineSchema.safeParse({ ...routine, days }).success).toBe(false);
    expect(habitRoutineSchema.safeParse(routine).success).toBe(true);
  });
  it("considera apenas dias programados na sequência", () => {
    expect(routineStreaks(routine, [log("2026-11-20"), log("2026-11-23")], "2026-11-24")).toEqual({ current: 2, best: 2 });
  });
  it("uma falta em dia programado quebra sequência mas preserva recorde", () => {
    expect(routineStreaks(routine, [log("2026-11-18"), log("2026-11-20"), log("2026-11-25")], "2026-11-25")).toEqual({ current: 1, best: 2 });
  });
  it("hoje continua aberto, sem zerar antes do fim do dia", () => {
    expect(routineStreaks(routine, [log("2026-11-20")], "2026-11-23")).toEqual({ current: 1, best: 1 });
    expect(routineStreaks(routine, [log("2026-11-20")], "2026-11-24")).toEqual({ current: 0, best: 1 });
  });
  it("registros repetidos no mesmo dia não aumentam sequência", () => {
    expect(routineStreaks(routine, [log("2026-11-23"), log("2026-11-23")], "2026-11-24")).toEqual({ current: 1, best: 1 });
  });
  it("agrupa sugestões sem diferenciar maiúsculas e ordena por frequência e recência", () => {
    expect(habitNameKey(" Meditar ")).toBe(habitNameKey("meditar"));
    expect(habitSuggestions([
      { name: "Meditar", date: "2026-11-20", time: "10:00" },
      { name: "meditar", date: "2026-11-22", time: "10:00" },
      { name: "Ler", date: "2026-11-24", time: "10:00" },
      { name: "Caminhar", date: "2026-11-23", time: "10:00" },
    ], [], ["Meditar"])).toEqual(["meditar", "Ler", "Caminhar"]);
  });
  it("não aceita data futura para registros avulsos", () => {
    expect(validHabitDate("2026-11-25", "2026-11-24")).toBe(false);
    expect(validHabitDate("2026-11-24", "2026-11-24")).toBe(true);
  });
  it("backups antigos recebem rotinas vazias e foto vazia", () => {
    const restored = validateBackup(backup);
    expect(restored.habitRoutines).toEqual([]);
    expect(restored.profile.avatarPath).toBe("");
  });
  it("preserva rotina e vínculo em backup moderno", () => {
    const restored = validateBackup({ ...backup, habitRoutines: [routine], habits: [{ id: "log", name: "Meditar", kind: "recorrente", date: "2026-11-23", time: "10:00", note: "", routine_id: routine.id }] });
    expect(restored.habitRoutines).toEqual([routine]);
    expect(restored.habits[0]?.routine_id).toBe("meditar");
  });
  it("rejeita referência a rotina ausente e nomes duplicados", () => {
    expect(() => validateBackup({ ...backup, habitRoutines: [routine, { ...routine, id: "2", name: "meditar" }] })).toThrow("Rotinas duplicadas");
    expect(() => validateBackup({ ...backup, habits: [{ id: "1", name: "Meditar", kind: "recorrente", date: "2026-11-23", time: "10:00", note: "", routine_id: "ausente" }] })).toThrow("Rotina inexistente");
  });
});

it("fotos aceitam somente JPG/PNG/WebP de até 5 MB", () => {
  expect(validProfilePhoto({ type: "image/png", size: PHOTO_MAX_BYTES })).toBe(true);
  expect(validProfilePhoto({ type: "image/svg+xml", size: 100 })).toBe(false);
  expect(validProfilePhoto({ type: "image/png", size: PHOTO_MAX_BYTES + 1 })).toBe(false);
});