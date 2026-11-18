import { describe, expect, it } from "vitest";
import { LINK_CODE_LIFETIME_MS, localNow, toAppointment } from "@/lib/whatsapp/extract";
import { telegramMessage, telegramLinkCode } from "@/lib/whatsapp/telegram";

const base = { is_appointment: true, title: "Dentista", date: "2026-11-16", time: "15:00", category: "saude" as const, description: null };

describe("Telegram → compromisso", () => {
  it("o código de vinculação expira em dez minutos", () => {
    expect(LINK_CODE_LIFETIME_MS).toBe(600000);
  });
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
  const message = { message_id: 7, date: 1794950000, chat: { id: 123456, type: "private" }, from: { id: 123456, is_bot: false }, text: "Amanhã tenho dentista às 14h" };
  it("aceita texto privado e identifica mensagens sem duplicar entre chats", () => {
    expect(telegramMessage({ update_id: 42, message })).toMatchObject({ updateId: 42, id: "tg-123456-7", phone: "123456", body: "Amanhã tenho dentista às 14h" });
    expect(telegramMessage({ update_id: 43, message: { ...message, chat: { id: 654321, type: "private" }, from: { id: 654321, is_bot: false } } })?.id).toBe("tg-654321-7");
  });
  it("ignora grupos", () => {
    expect(telegramMessage({ update_id: 42, message: { ...message, chat: { id: -123456, type: "group" } } })).toBeNull();
  });
  it("ignora mensagens sem texto", () => {
    expect(telegramMessage({ update_id: 42, message: { ...message, text: undefined, photo: [] } })).toBeNull();
  });
  it("ignora edições e mensagens de bots", () => {
    expect(telegramMessage({ update_id: 42, edited_message: message })).toBeNull();
    expect(telegramMessage({ update_id: 42, message: { ...message, from: { id: 123456, is_bot: true } } })).toBeNull();
  });
  it("aceita vínculo com start", () => {
    expect(telegramLinkCode("/start A1B2C3D4E5F60708")).toBe("A1B2C3D4E5F60708");
  });
  it("mantém vínculo com VINCULAR", () => {
    expect(telegramLinkCode("VINCULAR a1b2c3d4e5f60708")).toBe("A1B2C3D4E5F60708");
    expect(telegramLinkCode("/start inválido")).toBeNull();
  });
});
