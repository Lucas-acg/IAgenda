import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createHash, randomUUID } from "node:crypto";
import { GatewayError } from "@lovable.dev/ai-gateway";
import { extractAppointment } from "./ai.server";
import { toAppointment, localNow } from "./extract";
import { telegramMessage, telegramLinkCode } from "./telegram";

type Db = SupabaseClient<Database>;
export async function getAdmin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function saveReply(db: Db, id: string, phone: string, body: string) {
  const { error } = await db.from("wa_replies").upsert({ inbound_id: id, phone, body }, { onConflict: "inbound_id", ignoreDuplicates: true });
  if (error) throw error;
}
async function sendReply(db: Db, id: string) {
  const botToken = process.env["TELEGRAM_BOT_TOKEN"];
  if (!botToken) throw new Error("Bot não configurado.");
  const { data: control, error: controlError } = await db.from("wa_processing_control").select("paused_reason").eq("id", 1).maybeSingle();
  if (controlError) throw controlError;
  if (control?.paused_reason) return;
  const { data: rows, error } = await db.from("wa_replies").update({ state: "sending" }).eq("inbound_id", id).eq("state", "pending").select("*");
  if (error) throw error;
  const reply = rows?.[0]; if (!reply) return;
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: reply.phone, text: reply.body }),
    });
  } catch {
    const { error: updateError } = await db.from("wa_replies").update({ state: "unknown", error: "Resultado do envio desconhecido. Não reenviar automaticamente." }).eq("inbound_id", id);
    if (updateError) throw updateError;
    return;
  }
  const result = await response.json().catch(() => null) as { ok?: boolean; result?: { message_id?: number } } | null;
  const providerId = result?.ok && result.result?.message_id ? `${reply.phone}:${result.result.message_id}` : null;
  const { error: updateError } = await db.from("wa_replies").update(providerId && response.ok
    ? { state: "sent", provider_id: providerId, sent_at: new Date().toISOString(), error: null }
    : { state: response.ok ? "unknown" : "failed", error: `Telegram (${response.status}): envio não confirmado.` }).eq("inbound_id", id);
  if (updateError) throw updateError;
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
    const code = telegramLinkCode(m.body);
    if (code) {
      const { data: userId, error: redeemError } = await db.rpc("wa_redeem_code", { p_hash: createHash("sha256").update(code).digest("hex"), p_phone: m.phone });
      if (redeemError) throw redeemError;
      await saveReply(db, id, m.phone, userId ? "Telegram vinculado ao iAgenda! Envie seu compromisso com nome, data e horário. Exemplo: Amanhã tenho dentista às 14h." : "Código inválido, expirado ou Telegram já vinculado a outra conta. Gere um novo código em Configurações > Telegram.");
      await set({ state: "completed", user_id: userId });
      return;
    }
    const { data: link, error: linkError } = await db.from("wa_phone_links").select("user_id").eq("phone", m.phone).maybeSingle();
    if (linkError) throw linkError;
    if (!link) {
      await saveReply(db, id, m.phone, "Para usar o assistente, crie sua conta em https://ia-genda.lovable.app e vincule seu Telegram em Configurações > Telegram.");
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
    if (currentLink?.user_id !== link.user_id) throw new Error("Telegram desvinculado durante a análise.");
    const { error: appointmentError } = await db.rpc("wa_finalize_appointment", { p_message: id, p_user: link.user_id, p_appointment: { ...appointment, description: [appointment.description, "Criado pelo assistente Telegram do iAgenda."].filter(Boolean).join("\n") }, p_reply: `Registrado: ${appointment.title}, ${appointment.date.split("-").reverse().join("/")} às ${appointment.time} (horário de Brasília). Veja ou edite em https://ia-genda.lovable.app/calendario` });
    if (appointmentError) throw appointmentError;
    const { error: previousUpdateError } = await db.from("wa_assistant_messages").update({ state: "completed" }).eq("user_id", link.user_id).eq("state", "clarification").lt("sent_at", m.sent_at);
    if (previousUpdateError) throw previousUpdateError;
  } catch (failure) {
    if (failure instanceof GatewayError && [402,403,429].includes(failure.httpStatus ?? 0)) {
      const { error: pauseError } = await db.from("wa_processing_control").update({ paused_reason: `IA indisponível (${failure.httpStatus}). Requer revisão do administrador.` }).eq("id", 1);
      if (pauseError) throw pauseError;
    }
    await set({ state: "error", processing_error: "Não foi possível concluir. Verifique credenciais e processamento." });
    await saveReply(db, id, m.phone, "Não consegui concluir o registro agora. Confira sua agenda antes de enviar novamente ou tente mais tarde.");
  }
}
export async function processEvent(db: Db, ev: { id: number; event: string; payload: unknown; attempts: number }) {
  const { error: attemptError } = await db.from("whatsapp_webhook_events").update({ attempts: ev.attempts + 1 }).eq("id", ev.id); if (attemptError) throw attemptError;
  try {
    // Never process legacy channel deliveries or non-private/non-text Telegram updates.
    const message = ev.event === "telegram.message" ? telegramMessage(ev.payload) : null;
    if (message) {
      const { error } = await db.from("wa_assistant_messages").upsert({ id: message.id, phone: message.phone, body: message.body.slice(0, 4000), sent_at: message.sentAt }, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    }
    const { error } = await db.from("whatsapp_webhook_events").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("id", ev.id); if (error) throw error;
    return true;
  } catch {
    const { error } = await db.from("whatsapp_webhook_events").update({ processing_error: "Processamento pendente." }).eq("id", ev.id); if (error) throw error;
    return false;
  }
}
export async function processPending(db: Db, limit = 5) {
  const token = randomUUID();
  const { data: acquired, error: lockError } = await db.rpc("wa_acquire_lease", { p_token: token });
  if (lockError) throw lockError;
  if (!acquired) return;
  try {
  const { data: events, error } = await db.from("whatsapp_webhook_events").select("id,event,payload,attempts").is("processed_at", null).order("attempts").order("received_at").limit(limit); if (error) throw error;
  for (const event of events ?? []) await processEvent(db, event);
  const { data: messages, error: messageError } = await db.from("wa_assistant_messages").select("id").eq("state", "pending").like("id", "tg-%").order("sent_at").limit(limit); if (messageError) throw messageError;
  for (const m of messages ?? []) {
    const { data: control, error: controlError } = await db.from("wa_processing_control").select("paused_reason").eq("id", 1).single();
    if (controlError) throw controlError;
    if (control.paused_reason) break;
    await processMessage(db, m.id);
  }
  const { data: replies, error: replyError } = await db.from("wa_replies").select("inbound_id").eq("state", "pending").like("inbound_id", "tg-%").limit(limit); if (replyError) throw replyError;
  for (const reply of replies ?? []) await sendReply(db, reply.inbound_id);
  } finally {
    const { error: releaseError } = await db.from("wa_processing_control").update({ lease_until: null, lease_token: null }).eq("id", 1).eq("lease_token", token);
    if (releaseError) throw releaseError;
  }
}
export async function analyzePendingMessages(db: Db, userId: string, limit = 20) {
  const { data, error } = await db.from("wa_assistant_messages").select("id").eq("user_id", userId).eq("state", "pending").limit(limit); if (error) throw error;
  // Recovery is triggered by signed webhooks or the protected worker, never by page views.
  return data?.length ?? 0;
}
