import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookRequest } from "@lovable.dev/webhooks-js";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import type { Json } from "@/integrations/supabase/types";

// Receives WhatsApp Business events forwarded by Lovable. Signed with WHATSAPP_API_KEY.
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const expected = process.env["META_WEBHOOK_VERIFY_TOKEN"];
        if (!expected || url.searchParams.get("hub.mode") !== "subscribe" || url.searchParams.get("hub.verify_token") !== expected) return new Response("Não autorizado", { status: 403 });
        return new Response(url.searchParams.get("hub.challenge") ?? "");
      },
      POST: async ({ request }) => {
        const secret = process.env["WHATSAPP_API_KEY"];
        let deliveryId = request.headers.get("x-lovable-delivery")?.trim();
        let event = request.headers.get("x-lovable-event")?.trim();
        let payload: unknown;
        try {
        if (secret && deliveryId && event) {
          ({ payload } = await verifyWebhookRequest({ req: request, secret, maxBodyBytes: 4 * 1024 * 1024 }));
        } else {
          const appSecret = process.env["META_APP_SECRET"];
          if (!appSecret) return new Response("Meta não configurada", { status: 503 });
          const reader = request.body?.getReader();
          if (!reader) return new Response("Corpo ausente", { status: 400 });
          const chunks: Uint8Array[] = []; let bytes = 0;
          for (;;) {
            const part = await reader.read(); if (part.done) break;
            bytes += part.value.byteLength;
            if (bytes > 4 * 1024 * 1024) { await reader.cancel(); return new Response("Corpo muito grande", { status: 413 }); }
            chunks.push(part.value);
          }
          const raw = Buffer.concat(chunks);
          const signature = request.headers.get("x-hub-signature-256") ?? "";
          const expected = `sha256=${createHmac("sha256", appSecret).update(raw).digest("hex")}`;
          if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return new Response("Assinatura inválida", { status: 401 });
          payload = JSON.parse(raw.toString("utf8"));
          deliveryId = `meta-${createHash("sha256").update(raw).digest("hex")}`;
          event = "meta.delivery";
        }
        } catch {
          return new Response("Assinatura inválida", { status: 401 });
        }
        if (!deliveryId || !event) return new Response("Cabeçalhos ausentes", { status: 400 });

        const { getAdmin, processPending } = await import("@/lib/whatsapp/process.server");
        const { enqueueProcessing } = await import("@/lib/whatsapp/background.server");
        const db = await getAdmin();
        const { error: insErr } = await db.from("whatsapp_webhook_events")
          .upsert({ delivery_id: deliveryId, event, payload: payload as Json }, { onConflict: "delivery_id", ignoreDuplicates: true });
        if (insErr) { console.error("whatsapp inbox write failed", insErr); return new Response("Falha ao gravar", { status: 500 }); }
        const { data: row, error: selErr } = await db.from("whatsapp_webhook_events")
          .select("id,event,payload,attempts,processed_at").eq("delivery_id", deliveryId).single();
        if (selErr || !row) return new Response("Falha ao ler", { status: 500 });
        await enqueueProcessing(() => processPending(db, 5));
        return new Response("ok");
      },
    },
  },
});
