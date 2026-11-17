import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { extractAppointment } from "./ai.server";
import { toAppointment } from "./extract";

type Db = SupabaseClient<Database>;
export async function getAdmin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
interface WaText { id: string; timestamp?: string; type?: string; text?: { body?: string } }
interface Item { waId: string; name?: string; msg: WaText; direction: "in" | "out" }
export function itemsFromPayload(event: string, payload: unknown): Item[] {
  const value = (payload as { entry?: { changes?: { value?: Record<string, unknown> }[] }[] })?.entry?.[0]?.changes?.[0]?.value ?? {};
  const out: Item[] = [];
  if (event === "whatsapp.message") {
    const contacts = (value["contacts"] as { wa_id?: string; profile?: { name?: string } }[] | undefined) ?? [];
    for (const m of (value["messages"] as (WaText & { from?: string })[] | undefined) ?? []) {
      if (!m.from || !m.id) continue;
      const name = contacts.find((c) => c.wa_id === m.from)?.profile?.name;
      out.push({ waId: m.from, msg: m, direction: "in", ...(name ? { name } : {}) });
    }
  }
  if (event === "whatsapp.smb_message_echoes") {
    for (const m of (value["message_echoes"] as (WaText & { to?: string })[] | undefined) ?? []) {
      if (m.to && m.id) out.push({ waId: m.to, msg: m, direction: "out" });
    }
  }
  return out;
}
export async function analyzeMessage(db: Db, userId: string, messageId: string, retryErrors = false) {
  const { data: m, error } = await db.from("wa_messages").select("*").eq("user_id", userId).eq("id", messageId).maybeSingle();
  if (error) throw error;
  if (!m || (m.ai_status !== "pending" && !(retryErrors && m.ai_status === "error"))) return;
  const { data: c, error: cErr } = await db.from("wa_contacts").select("watched,monitored_since").eq("user_id", userId).eq("wa_id", m.wa_id).maybeSingle();
  if (cErr) throw cErr;
  const eligible = c?.watched && c.monitored_since && new Date(m.sent_at) >= new Date(c.monitored_since);
  const set = async (patch: Database["public"]["Tables"]["wa_messages"]["Update"]) => {
    const { error: e } = await db.from("wa_messages").update(patch).eq("user_id", userId).eq("id", m.id);
    if (e) throw e;
  };
  if (!eligible || !m.body.trim()) { await set({ ai_status: "ignored" }); return; }
  const { data: claimed, error: claimErr } = await db.from("wa_messages").update({ ai_status: "analyzing", ai_error: null }).eq("user_id", userId).eq("id", m.id).eq("ai_status", m.ai_status).select("id");
  if (claimErr) throw claimErr;
  if (!claimed?.length) return;
  let extraction;
  try { extraction = await extractAppointment(m.body, "America/Sao_Paulo", new Date(m.sent_at)); }
  catch { await set({ ai_status: "error", ai_error: "Não foi possível analisar. Tente novamente." }); return; }
  const appt = toAppointment(extraction);
  if (!appt) { await set({ ai_status: "not_appointment", ai_error: null }); return; }
  // Recheck monitoring after the AI call: disabling a contact takes immediate effect.
  const { data: current, error: monitorError } = await db.from("wa_contacts").select("watched,monitored_since").eq("user_id", userId).eq("wa_id", m.wa_id).single();
  if (monitorError) throw monitorError;
  if (!current.watched || !current.monitored_since || new Date(m.sent_at) < new Date(current.monitored_since)) { await set({ ai_status: "ignored" }); return; }
  const apptId = `wa-${m.id}`;
  const { error: insertError } = await db.from("appointments").upsert({ id: apptId, user_id: userId, ...appt, description: [appt.description, `Contato: ${m.wa_id}`, "Criado a partir do WhatsApp."].filter(Boolean).join("\n"), reminder: appt.time ? 15 : 0, done: false }, { onConflict: "user_id,id", ignoreDuplicates: true });
  if (insertError) { await set({ ai_status: "error", ai_error: "Não foi possível salvar o compromisso." }); throw insertError; }
  await set({ ai_status: "created", appointment_id: apptId, appointment_title: appt.title, appointment_date: appt.date, appointment_time: appt.time, ai_error: null });
}
export async function processEvent(db: Db, ev: { id: number; event: string; payload: unknown; attempts: number }) {
  const { error: incrementError } = await db.from("whatsapp_webhook_events").update({ attempts: ev.attempts + 1 }).eq("id", ev.id);
  if (incrementError) throw incrementError;
  try {
    const value = (ev.payload as { entry?: { id?: string; changes?: { value?: { metadata?: { phone_number_id?: string }; state_sync?: { contact?: { phone_number?: string; full_name?: string }; action?: string }[]; event?: string } }[] }[] })?.entry?.[0];
    const change = value?.changes?.[0]?.value;
    const phoneId = change?.metadata?.phone_number_id;
    const items = itemsFromPayload(ev.event, ev.payload);
    if (items.length || change?.state_sync?.length) {
      if (!phoneId) throw new Error("Mensagem sem identificação do número Business.");
      const { data: owner, error } = await db.from("wa_accounts").select("user_id,active").eq("phone_number_id", phoneId).maybeSingle();
      if (error) throw error;
      if (!owner) throw new Error("Número ainda não vinculado.");
      for (const it of items) {
        const sentAt = new Date(Number(it.msg.timestamp) * 1000);
        if (Number.isNaN(sentAt.getTime())) throw new Error("Data de envio inválida.");
        const { data: old, error: readError } = await db.from("wa_contacts").select("last_message_at,watched,monitored_since").eq("user_id", owner.user_id).eq("wa_id", it.waId).maybeSingle();
        if (readError) throw readError;
        const newer = !old || new Date(old.last_message_at) <= sentAt;
        const { error: contactError } = await db.from("wa_contacts").upsert({ user_id: owner.user_id, wa_id: it.waId, ...(it.name ? { contact_name: it.name } : {}), ...(newer ? { last_message_at: sentAt.toISOString(), last_preview: (it.msg.text?.body ?? `[${it.msg.type ?? "mídia"}]`).slice(0, 140) } : {}) }, { onConflict: "user_id,wa_id" });
        if (contactError) throw contactError;
        const watched = owner.active && old?.watched && old.monitored_since && sentAt >= new Date(old.monitored_since);
        const { error: messageError } = await db.from("wa_messages").upsert({ user_id: owner.user_id, id: it.msg.id, wa_id: it.waId, direction: it.direction, body: (it.msg.text?.body ?? "").slice(0, 4000), sent_at: sentAt.toISOString(), ai_status: watched ? "pending" : "ignored" }, { onConflict: "user_id,id", ignoreDuplicates: true });
        if (messageError) throw messageError;
      }
      for (const sync of change?.state_sync ?? []) {
        const waId = sync.contact?.phone_number;
        if (!waId) continue;
        const { error: syncError } = sync.action === "remove"
          ? await db.from("wa_contacts").update({ watched: false }).eq("user_id", owner.user_id).eq("wa_id", waId)
          : await db.from("wa_contacts").upsert({ user_id: owner.user_id, wa_id: waId, contact_name: sync.contact?.full_name ?? "" }, { onConflict: "user_id,wa_id" });
        if (syncError) throw syncError;
      }
    }
    const { error } = await db.from("whatsapp_webhook_events").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("id", ev.id);
    if (error) throw error;
    return true;
  } catch {
    const { error } = await db.from("whatsapp_webhook_events").update({ processing_error: "Processamento pendente; verifique a conexão do número." }).eq("id", ev.id);
    if (error) throw error;
    return false;
  }
}
export async function processPending(db: Db, limit = 5) {
  const { data, error } = await db.from("whatsapp_webhook_events").select("id,event,payload,attempts").is("processed_at", null).order("attempts").order("received_at").limit(limit);
  if (error) throw error;
  for (const ev of data ?? []) await processEvent(db, ev);
  const { data: messages, error: msgError } = await db.from("wa_messages").select("id,user_id").eq("ai_status", "pending").order("sent_at").limit(limit);
  if (msgError) throw msgError;
  for (const m of messages ?? []) await analyzeMessage(db, m.user_id, m.id);
}
export async function analyzePendingMessages(db: Db, userId: string, limit = 20) {
  const { data, error } = await db.from("wa_messages").select("id").eq("user_id", userId).in("ai_status", ["pending", "error"]).order("sent_at", { ascending: false }).limit(limit);
  if (error) throw error;
  for (const m of data ?? []) await analyzeMessage(db, userId, m.id, true);
  return data?.length ?? 0;
}
