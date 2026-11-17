import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { createHash } from "node:crypto";
import { extractAppointment } from "./ai.server";
import { toAppointment, localNow } from "./extract";

type Db = SupabaseClient<Database>;
export async function getAdmin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
type MetaValue = {
  metadata?: { phone_number_id?: string };
  messages?: { id: string; from: string; timestamp: string; type?: string; text?: { body?: string } }[];
  statuses?: { id: string; status: string; timestamp: string; errors?: unknown[] }[];
};
function changes(payload: unknown): MetaValue[] {
  return ((payload as { entry?: { changes?: { value?: MetaValue }[] }[] })?.entry ?? []).flatMap((e) => (e.changes ?? []).flatMap((c) => c.value ? [c.value] : []));
}
/** Normalizer retained for extraction regression tests; echoes are never analyzed by the shared assistant. */
export function itemsFromPayload(event: string, payload: unknown) {
  const value = changes(payload)[0];
  if (event === "whatsapp.message") return (value?.messages ?? []).map((m) => ({ waId: m.from, msg: m, direction: "in" as const }));
  return [];
}
async function saveReply(db: Db, id: string, phone: string, body: string) {
  const { error } = await db.from("wa_replies").upsert({ inbound_id: id, phone, body }, { onConflict: "inbound_id", ignoreDuplicates: true });
  if (error) throw error;
}
async function sendReply(db: Db, id: string) {
  const apiKey = process.env["WHATSAPP_API_KEY"], lovableKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey || !lovableKey) throw new Error("Número oficial não configurado.");
  const { data: rows, error } = await db.from("wa_replies").update({ state: "sending" }).eq("inbound_id", id).eq("state", "pending").select("*");
  if (error) throw error;
  const reply = rows?.[0]; if (!reply) return;
  let response: Response;
  try {
    response = await fetch("https://connector-gateway.lovable.dev/whatsapp/messages", {
      method: "POST", headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: reply.phone, type: "text", text: { body: reply.body } }),
    });
  } catch {
    const { error: updateError } = await db.from("wa_replies").update({ state: "unknown", error: "Resultado do envio desconhecido. Não reenviar automaticamente." }).eq("inbound_id", id);
    if (updateError) throw updateError;
    return;
  }
  const result = await response.json() as { messages?: { id?: string }[]; error?: { message?: string; code?: number } };
  const providerId = result.messages?.[0]?.id;
  const { error: updateError } = await db.from("wa_replies").update(providerId && response.ok
    ? { state: "accepted", provider_id: providerId, error: null }
    : { state: response.ok ? "unknown" : "failed", error: `WhatsApp (${response.status}): ${result.error?.message ?? "Envio não confirmado."}` }).eq("inbound_id", id);
  if (updateError) throw updateError;
  if (providerId) await reconcileStatuses(db, providerId);
}
async function applyStatus(db: Db, status: NonNullable<MetaValue["statuses"]>[number]) {
  const { data, error } = await db.from("wa_replies").select("state,sent_at,delivered_at,read_at,failed_at").eq("provider_id", status.id).maybeSingle();
  if (error) throw error;
  if (!data) return false;
  const at = new Date(Number(status.timestamp) * 1000);
  if (Number.isNaN(at.getTime())) throw new Error("Horário de entrega inválido.");
  const rank: Record<string, number> = { accepted: 0, sent: 1, delivered: 2, read: 3, failed: 0 };
  const patch: Database["public"]["Tables"]["wa_replies"]["Update"] = {};
  if (status.status === "sent" && !data.sent_at) patch.sent_at = at.toISOString();
  if (status.status === "delivered" && !data.delivered_at) patch.delivered_at = at.toISOString();
  if (status.status === "read" && !data.read_at) patch.read_at = at.toISOString();
  if (status.status === "failed") { if (!data.failed_at) patch.failed_at = at.toISOString(); patch.error = JSON.stringify(status.errors ?? []).slice(0, 1000); }
  if ((rank[status.status] ?? -1) >= (rank[data.state] ?? -1) && !(status.status === "failed" && (rank[data.state] ?? 0) >= 2)) patch.state = status.status;
  const { error: updateError } = await db.from("wa_replies").update(patch).eq("provider_id", status.id);
  if (updateError) throw updateError;
  return true;
}
async function reconcileStatuses(db: Db, providerId: string) {
  const { data, error } = await db.from("whatsapp_webhook_events").select("payload").eq("event", "whatsapp.status").order("received_at", { ascending: false }).limit(100);
  if (error) throw error;
  for (const row of data ?? []) for (const value of changes(row.payload)) for (const s of value.statuses ?? []) if (s.id === providerId) await applyStatus(db, s);
}
async function processMessage(db: Db, id: string) {
  const { data: m, error } = await db.from("wa_assistant_messages").select("*").eq("id", id).single();
  if (error) throw error;
  if (m.state !== "pending") return;
  const { data: claimed, error: claimError } = await db.from("wa_assistant_messages").update({ state: "processing" }).eq("id", id).eq("state", "pending").select("id");
  if (claimError) throw claimError;
  if (!claimed?.length) return;
  const set = async (patch: Database["public"]["Tables"]["wa_assistant_messages"]["Update"]) => {
    const { error: e } = await db.from("wa_assistant_messages").update(patch).eq("id", id); if (e) throw e;
  };
  try {
    const code = /^VINCULAR\s+([A-F0-9]{16})$/i.exec(m.body.trim());
    if (code?.[1]) {
      const { data: userId, error: redeemError } = await db.rpc("wa_redeem_code", { p_hash: createHash("sha256").update(code[1].toUpperCase()).digest("hex"), p_phone: m.phone });
      if (redeemError) throw redeemError;
      await saveReply(db, id, m.phone, userId ? "Telefone vinculado ao iAgenda! Envie seu compromisso com nome, data e horário. Exemplo: Amanhã tenho dentista às 14h." : "Código inválido, expirado ou telefone já vinculado a outra conta. Gere um novo código em Configurações > WhatsApp.");
      await set({ state: "completed", user_id: userId });
      return;
    }
    const { data: link, error: linkError } = await db.from("wa_phone_links").select("user_id").eq("phone", m.phone).maybeSingle();
    if (linkError) throw linkError;
    if (!link) {
      await saveReply(db, id, m.phone, "Para usar o assistente, crie sua conta em https://ia-genda.lovable.app e vincule seu telefone em Configurações > WhatsApp.");
      await set({ state: "completed" }); return;
    }
    await set({ user_id: link.user_id });
    if (!m.body.trim()) {
      await saveReply(db, id, m.phone, "Envie seu compromisso por texto, com nome, data e horário."); await set({ state: "completed" }); return;
    }
    const { data: previous, error: previousError } = await db.from("wa_assistant_messages").select("body").eq("user_id", link.user_id).eq("state", "clarification").lt("sent_at", m.sent_at).gte("sent_at", new Date(new Date(m.sent_at).getTime() - 24 * 3600_000).toISOString()).order("sent_at", { ascending: false }).limit(1);
    if (previousError) throw previousError;
    const extraction = await extractAppointment(m.body, "America/Sao_Paulo", new Date(m.sent_at), previous?.[0]?.body);
    const appointment = toAppointment(extraction);
    const now = localNow("America/Sao_Paulo", new Date(m.sent_at));
    const future = appointment && `${appointment.date}T${appointment.time}` > `${now.date}T${now.time}`;
    if (!appointment || extraction.clarification || !future) {
      const question = extraction.clarification || (extraction.is_appointment ? "Qual o nome, a data e o horário futuro do compromisso?" : "Envie o nome, a data e o horário do compromisso que deseja registrar.");
      await saveReply(db, id, m.phone, question); await set({ state: "clarification", clarification: question }); return;
    }
    // Verify the link again before writing; never trust an identity carried in a message.
    const { data: currentLink, error: currentError } = await db.from("wa_phone_links").select("user_id").eq("phone", m.phone).maybeSingle();
    if (currentError) throw currentError;
    if (currentLink?.user_id !== link.user_id) throw new Error("Telefone desvinculado durante a análise.");
    const appointmentId = `wa-${id}`;
    const { error: appointmentError } = await db.from("appointments").upsert({ user_id: link.user_id, id: appointmentId, ...appointment, description: [appointment.description, "Criado pelo assistente WhatsApp do iAgenda."].filter(Boolean).join("\n"), done: false, reminder: 15 }, { onConflict: "user_id,id", ignoreDuplicates: true });
    if (appointmentError) throw appointmentError;
    await saveReply(db, id, m.phone, `Registrado: ${appointment.title}, ${appointment.date.split("-").reverse().join("/")} às ${appointment.time} (horário de Brasília). Veja ou edite em https://ia-genda.lovable.app/calendario`);
    await set({ state: "created", appointment_id: appointmentId });
    const { error: previousUpdateError } = await db.from("wa_assistant_messages").update({ state: "completed" }).eq("user_id", link.user_id).eq("state", "clarification").lt("sent_at", m.sent_at);
    if (previousUpdateError) throw previousUpdateError;
  } catch {
    await set({ state: "error", processing_error: "Não foi possível concluir. Verifique credenciais e processamento." });
  }
}
export async function processEvent(db: Db, ev: { id: number; event: string; payload: unknown; attempts: number }) {
  const { error: attemptError } = await db.from("whatsapp_webhook_events").update({ attempts: ev.attempts + 1 }).eq("id", ev.id); if (attemptError) throw attemptError;
  try {
    for (const value of changes(ev.payload)) {
      for (const m of value.messages ?? []) {
        if (!/^\d{8,15}$/.test(m.from) || !m.id || !m.timestamp) throw new Error("Mensagem inválida.");
        const sentAt = new Date(Number(m.timestamp) * 1000); if (Number.isNaN(sentAt.getTime())) throw new Error("Data inválida.");
        const { error } = await db.from("wa_assistant_messages").upsert({ id: m.id, phone: m.from, body: (m.text?.body ?? "").slice(0, 4000), sent_at: sentAt.toISOString() }, { onConflict: "id", ignoreDuplicates: true });
        if (error) throw error;
      }
      for (const status of value.statuses ?? []) await applyStatus(db, status);
    }
    const { error } = await db.from("whatsapp_webhook_events").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("id", ev.id); if (error) throw error;
    return true;
  } catch {
    const { error } = await db.from("whatsapp_webhook_events").update({ processing_error: "Processamento pendente." }).eq("id", ev.id); if (error) throw error;
    return false;
  }
}
export async function processPending(db: Db, limit = 5) {
  const { data: events, error } = await db.from("whatsapp_webhook_events").select("id,event,payload,attempts").is("processed_at", null).order("attempts").order("received_at").limit(limit); if (error) throw error;
  for (const event of events ?? []) await processEvent(db, event);
  const { data: messages, error: messageError } = await db.from("wa_assistant_messages").select("id").eq("state", "pending").order("sent_at").limit(limit); if (messageError) throw messageError;
  for (const m of messages ?? []) await processMessage(db, m.id);
  const { data: replies, error: replyError } = await db.from("wa_replies").select("inbound_id").eq("state", "pending").limit(limit); if (replyError) throw replyError;
  for (const reply of replies ?? []) await sendReply(db, reply.inbound_id);
}
export async function analyzePendingMessages(db: Db, userId: string, limit = 20) {
  const { data, error } = await db.from("wa_assistant_messages").select("id").eq("user_id", userId).eq("state", "pending").limit(limit); if (error) throw error;
  for (const m of data ?? []) await processMessage(db, m.id);
  return data?.length ?? 0;
}
