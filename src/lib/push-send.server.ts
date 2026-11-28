import { buildPushPayload } from "@block65/webcrypto-web-push";
import { pushSubscriptionSchema } from "./push-validation";
import { webPushKeys } from "./push-keys.server";

export async function deliverPush(row: { endpoint: string; p256dh: string; auth: string }, message: { title: string; body: string; tag: string; url: string }) {
  const subscription = pushSubscriptionSchema.parse({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } });
  const payload = await buildPushPayload({ data: message, options: { ttl: 600, urgency: "high" } }, { ...subscription, expirationTime: null }, await webPushKeys());
  const response = await fetch(subscription.endpoint, { ...payload, redirect: "error", signal: AbortSignal.timeout(10_000) });
  await response.body?.cancel();
  return response.status;
}

export async function sendDueHabitPushes() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = await supabaseAdmin.rpc("claim_habit_push_notifications");
  if (result.error) throw new Error("Não foi possível preparar os avisos.");
  const rows = result.data ?? [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < rows.length) {
      const row = rows[cursor++]; if (!row) return;
      let status: "sent" | "failed" | "unknown" = "unknown";
      try {
        const response = await deliverPush(row, { title: row.title, body: `Sua rotina das ${row.scheduled_time}`, tag: row.notice_key, url: "/" });
        status = response >= 200 && response < 300 ? "sent" : "failed";
        if (response === 404 || response === 410) await supabaseAdmin.from("push_subscriptions").delete().eq("id", row.subscription_id);
      } catch { /* Unknown delivery is never blindly replayed. */ }
      const updated = await supabaseAdmin.from("habit_push_deliveries").update({ status }).eq("id", row.delivery_id);
      if (updated.error) console.error("IAgenda: não foi possível registrar o resultado de um aviso.");
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, rows.length) }, () => worker()));
  return { processed: rows.length };
}