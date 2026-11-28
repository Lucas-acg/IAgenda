import { webcrypto } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { encryptBackup, decryptBackup } from "@/lib/encrypted-backup";
import { normalizeAppearance, DEFAULT_APPEARANCE } from "@/lib/appearance";
import { habitRoutineSchema, validateBackup } from "@/lib/backup";
import { routineReminder } from "@/lib/routine-reminder";

vi.stubGlobal("crypto", webcrypto);
afterAll(() => vi.unstubAllGlobals());
const routine = { id: "r1", name: "Meditar", days: [6], active: true, time: "13:30", notify: true };
describe("Preferências e notificações solicitadas", () => {
  it("permite ano e mantém mês como padrão", () => {
    expect(normalizeAppearance({ calendarView: "ano" }).calendarView).toBe("ano");
    expect(DEFAULT_APPEARANCE.calendarView).toBe("mes");
  });
  it("não conserva a preferência de espaçamento compacto", () => {
    expect(normalizeAppearance()).not.toHaveProperty("compact");
  });
  it("exige horário válido para notificação da rotina", () => {
    expect(habitRoutineSchema.safeParse(routine).success).toBe(true);
    expect(habitRoutineSchema.safeParse({ ...routine, time: null }).success).toBe(false);
    expect(habitRoutineSchema.safeParse({ ...routine, time: "24:00" }).success).toBe(false);
  });
  it("notifica somente no horário e no dia programado", () => {
    expect(routineReminder(routine, [], new Date(2026, 10, 28, 13, 29))).toBeNull();
    expect(routineReminder(routine, [], new Date(2026, 10, 28, 13, 30))?.key).toBe("routine-r1-2026-11-28-13:30");
    expect(routineReminder(routine, [], new Date(2026, 10, 29, 13, 30))).toBeNull();
  });
  it("não notifica rotinas pausadas, desativadas ou concluídas", () => {
    const now = new Date(2026, 10, 28, 13, 30);
    expect(routineReminder({ ...routine, active: false }, [], now)).toBeNull();
    expect(routineReminder({ ...routine, notify: false }, [], now)).toBeNull();
    expect(routineReminder(routine, [{ routine_id: "r1", date: "2026-11-28" }], now)).toBeNull();
  });
  it("a chave muda quando o horário da rotina muda", () => {
    const now = new Date(2026, 10, 28, 13, 35);
    expect(routineReminder(routine, [], now)?.key).not.toBe(routineReminder({ ...routine, time: "13:35" }, [], now)?.key);
  });
  it("preserva nota e referência privada da foto no backup", () => {
    const data = validateBackup({ appointments: [], entries: [], habits: [], reminders: [], importantDays: [{ id: "day", name: "Ana", date: "11-28", notify: true, note: "Comprar flores", photoPath: "11111111-1111-1111-1111-111111111111/important-foto.png" }], profile: { name: "", height: "", weight: "", wake: "07:00", sleep: "23:00", waterGoal: 8, sleepGoal: 8 }, prefs: { notifications: false, weekStartsMonday: false, calendarView: "ano", compact: true } });
    expect(data.importantDays[0]?.note).toBe("Comprar flores");
    expect(data.importantDays[0]?.photoPath).toBe("11111111-1111-1111-1111-111111111111/important-foto.png");
    expect(data.prefs.calendarView).toBe("ano"); expect(data.prefs).not.toHaveProperty("compact");
  });
});
describe("Backup criptografado", () => {
  it("exporta sem dados legíveis e restaura com a senha correta", async () => {
    const data = { note: "Informação privada da Ana" };
    const file = await encryptBackup(data, "senha-exclusiva-de-teste");
    expect(file).not.toContain(data.note);
    expect(await decryptBackup(JSON.parse(file), "senha-exclusiva-de-teste")).toEqual(data);
    expect(JSON.parse(file)).toMatchObject({ cipher: "AES-GCM", kdf: "PBKDF2-SHA256", iterations: 310000 });
  });
  it("rejeita senha incorreta", async () => {
    const file = JSON.parse(await encryptBackup({ private: true }, "senha-exclusiva-de-teste"));
    await expect(decryptBackup(file, "senha-incorreta")).rejects.toThrow();
  });
  it("rejeita dados adulterados e utiliza aleatoriedade em cada arquivo", async () => {
    const first: { ciphertext: string } = JSON.parse(await encryptBackup({ private: true }, "senha-exclusiva-de-teste"));
    const second: { ciphertext: string } = JSON.parse(await encryptBackup({ private: true }, "senha-exclusiva-de-teste"));
    expect(first.ciphertext).not.toBe(second.ciphertext);
    const tampered = { ...first, ciphertext: (first.ciphertext.startsWith("A") ? "B" : "A") + first.ciphertext.slice(1) };
    await expect(decryptBackup(tampered, "senha-exclusiva-de-teste")).rejects.toThrow();
  });
});