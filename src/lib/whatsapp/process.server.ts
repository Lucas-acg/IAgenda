import type { SupabaseClient } from "@supabase/supabase-js";
import { AiGatewayError, extractAppointment } from "./ai.server";
import { toAppointment } from "./extract";

// New WhatsApp tables are not in the generated types yet; use an untyped client for them.
type Db = SupabaseClient;

export async function getAdmin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

interface WaText { id: string; timestamp?: string; type?: string; text?: { body?: string } }
interface Item { waId: string; name?: string; msg: WaText; direction: "in" | "out" }

/** Normalises Meta's payload (incoming messages and messages the business sent from the phone app). */
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

async function ownerOf(db: Db) {
  const { data, error } = await db.from("whatsapp_owner").select("user_id").eq("id", 1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: prof, error: pErr } = await db.from("profiles").select("timezone").eq("user_id", data.user_id).maybeSingle();
  if (pErr) throw pErr;
  return { userId: data.user_id as string, timezone: (prof?.timezone as string | undefined) || "America/Sao_Paulo" };
}

/** Stores conversation + message, then (if the chat is watched) asks the AI and creates the appointment. Retry-safe. */
async function handleItem(db: Db, owner: { userId: string; timezone: string }, it: Item) {
  const body = it.msg.text?.body ?? "";
  const sentAt = new Date(Number(it.msg.timestamp ?? Date.now() / 1000) * 1000);
  const { data: conv, error: cErr } = await db.from("whatsapp_conversations").select("watched,last_message_at").eq("wa_id", it.waId).maybeSingle();
  if (cErr) throw cErr;
  const newer = !conv || new Date(conv.last_message_at as string) <= sentAt;
  const row: Record<string, unknown> = { wa_id: it.waId, user_id: owner.userId };
  if (it.name) row["contact_name"] = it.name;
  if (newer) { row["last_message_at"] = sentAt.toISOString(); row["last_preview"] = (body || `[${it.msg.type ?? "mídia"}]`).slice(0, 140); }
  const { error: uErr } = await db.from("whatsapp_conversations").upsert(row, { onConflict: "wa_id" });
  if (uErr) throw uErr;

  const { error: mErr } = await db.from("whatsapp_messages").upsert(
    { id: it.msg.id, user_id: owner.userId, wa_id: it.waId, direction: it.direction, body, sent_at: sentAt.toISOString() },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (mErr) throw mErr;
  await analyzeMessage(db, owner, it.msg.id);
}

/** Runs the AI on one stored message if it is still pending and its conversation is watched. */
export async function analyzeMessage(db: Db, owner: { userId: string; timezone: string }, messageId: string) {
  const { data: m, error } = await db.from("whatsapp_messages").select("id,wa_id,body,sent_at,ai_status").eq("id", messageId).maybeSingle();
  if (error) throw error;
  if (!m || (m.ai_status !== "pending" && m.ai_status !== "error")) return;
  const { data: conv, error: cErr } = await db.from("whatsapp_conversations").select("watched").eq("wa_id", m.wa_id).maybeSingle();
  if (cErr) throw cErr;
  if (!conv?.watched) return; // stays pending: analysed if the user later starts watching this chat
  const set = async (patch: Record<string, unknown>) => {
    const { error: e } = await db.from("whatsapp_messages").update(patch).eq("id", m.id);
    if (e) throw e;
  };
  if (!(m.body as string).trim()) { await set({ ai_status: "ignored", ai_error: null }); return; }

  let extraction;
  try {
    extraction = await extractAppointment(m.body as string, owner.timezone, new Date(m.sent_at as string));
  } catch (e) {
    const err = e as AiGatewayError;
    await set({ ai_status: "error", ai_error: err.message.slice(0, 500) });
    if (err.retryable) throw err; // keep the webhook event pending for retry
    return;
  }
  const appt = toAppointment(extraction);
  if (!appt) { await set({ ai_status: "not_appointment", ai_error: null }); return; }

  const apptId = `wa-${m.id}`.slice(0, 200); // deterministic → no duplicates on retry
  const { error: aErr } = await db.from("appointments").upsert(
    { id: apptId, user_id: owner.userId, ...appt, description: [appt.description, "Criado a partir do WhatsApp."].filter(Boolean).join("\n"), reminder: 15, done: false },
    { onConflict: "user_id,id", ignoreDuplicates: true },
  );
  if (aErr) throw aErr;
  await set({ ai_status: "created", ai_error: null, appointment_id: apptId, appointment_title: appt.title, appointment_date: appt.date, appointment_time: appt.time });
}

/** Processes one stored webhook event. Unknown events are acknowledged and kept in the inbox. */
export async function processEvent(db: Db, ev: { id: number; event: string; payload: unknown; attempts: number }) {
  const { error: incErr } = await db.from("whatsapp_webhook_events").update({ attempts: ev.attempts + 1 }).eq("id", ev.id);
  if (incErr) throw incErr;
  try {
    const items = itemsFromPayload(ev.event, ev.payload);
    if (items.length) {
      const owner = await ownerOf(db);
      if (!owner) throw new Error("Nenhuma conta do IAgenda ativou a integração ainda");
      for (const it of items) await handleItem(db, owner, it);
    }
    const { error } = await db.from("whatsapp_webhook_events").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("id", ev.id);
    if (error) throw error;
    return true;
  } catch (e) {
    await db.from("whatsapp_webhook_events").update({ processing_error: String((e as Error).message ?? e).slice(0, 500) }).eq("id", ev.id);
    return false;
  }
}

/** Bounded recovery: retries a few unfinished events, least-attempted first so failing rows cannot starve others. */
export async function processPending(db: Db, limit = 5) {
  const { data, error } = await db.from("whatsapp_webhook_events").select("id,event,payload,attempts")
    .is("processed_at", null).lt("attempts", 8).lt("received_at", new Date(Date.now() - 30_000).toISOString())
    .order("attempts", { ascending: true }).order("received_at", { ascending: true }).limit(limit);
  if (error) throw error;
  for (const ev of data ?? []) await processEvent(db, ev as { id: number; event: string; payload: unknown; attempts: number });
}

/** Re-analyses pending/failed messages of watched chats (used when the user turns a chat on). */
export async function analyzePendingMessages(db: Db, userId: string, limit = 20) {
  const owner = await ownerOf(db);
  if (!owner || owner.userId !== userId) return 0;
  const { data, error } = await db.from("whatsapp_messages").select("id,wa_id,whatsapp_conversations!inner(watched)")
    .eq("user_id", userId).in("ai_status", ["pending", "error"]).eq("whatsapp_conversations.watched", true)
    .gte("sent_at", new Date(Date.now() - 7 * 86400_000).toISOString()).order("sent_at", { ascending: false }).limit(limit);
  if (error) throw error;
  for (const m of data ?? []) await analyzeMessage(db, owner, m.id as string).catch(() => {});
  return data?.length ?? 0;
}
