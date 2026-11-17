import { describe, expect, it } from "vitest";
import { localNow, toAppointment } from "@/lib/whatsapp/extract";
import { itemsFromPayload } from "@/lib/whatsapp/process.server";

const base = { is_appointment: true, title: "Dentista", date: "2026-11-16", time: "15:00", category: "saude" as const, description: null };

describe("WhatsApp → compromisso", () => {
  it("cria compromisso quando há data e hora marcada", () => {
    expect(toAppointment(base)).toEqual({ title: "Dentista", date: "2026-11-16", time: "15:00", category: "saude", description: "" });
  });
  it("solicita esclarecimento em vez de criar sem horário", () => {
    expect(toAppointment({ ...base, time: null })).toBeNull();
  });
  it("ignora evento sem nome ou sem data", () => {
    expect(toAppointment({ ...base, title: null })).toBeNull();
    expect(toAppointment({ ...base, date: null })).toBeNull();
  });
  it("não cria quando a IA diz que não é compromisso", () => {
    expect(toAppointment({ ...base, is_appointment: false })).toBeNull();
  });
  it("rejeita data inválida", () => {
    expect(toAppointment({ ...base, date: "2026-02-30" })).toBeNull();
  });
  it("usa o fuso do usuário para 'agora'", () => {
    expect(localNow("America/Sao_Paulo", new Date("2026-11-15T02:30:00Z"))).toMatchObject({ date: "2026-11-14", time: "23:30" });
  });
  it("o assistente compartilhado só recebe mensagens dirigidas a ele", () => {
    const wrap = (value: unknown) => ({ entry: [{ changes: [{ value }] }] });
    expect(itemsFromPayload("whatsapp.message", wrap({ messages: [{ from: "5511", id: "m1", text: { body: "oi" } }] }))[0]).toMatchObject({ waId: "5511", direction: "in" });
    expect(itemsFromPayload("whatsapp.smb_message_echoes", wrap({ message_echoes: [{ to: "5522", id: "m2", text: { body: "amanhã 10h" } }] }))).toEqual([]);
  });
});
