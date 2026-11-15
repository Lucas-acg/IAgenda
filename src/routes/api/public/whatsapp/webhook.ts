import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookRequest } from "@lovable.dev/webhooks-js";

// Receives WhatsApp Business events forwarded by Lovable. Signed with WHATSAPP_API_KEY.
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["WHATSAPP_API_KEY"];
        if (!secret) return new Response("WhatsApp não configurado", { status: 500 });
        const deliveryId = request.headers.get("x-lovable-delivery")?.trim();
        const event = request.headers.get("x-lovable-event")?.trim();
        let payload: unknown;
        try {
          ({ payload } = await verifyWebhookRequest({ req: request, secret, maxBodyBytes: 4 * 1024 * 1024 }));
        } catch {
          return new Response("Assinatura inválida", { status: 401 });
        }
        if (!deliveryId || !event) return new Response("Cabeçalhos ausentes", { status: 400 });

        const { getAdmin, processEvent, processPending } = await import("@/lib/whatsapp/process.server");
        const db = await getAdmin();
        const { error: insErr } = await db.from("whatsapp_webhook_events")
          .upsert({ delivery_id: deliveryId, event, payload }, { onConflict: "delivery_id", ignoreDuplicates: true });
        if (insErr) { console.error("whatsapp inbox write failed", insErr); return new Response("Falha ao gravar", { status: 500 }); }
        const { data: row, error: selErr } = await db.from("whatsapp_webhook_events")
          .select("id,event,payload,attempts,processed_at").eq("delivery_id", deliveryId).single();
        if (selErr || !row) return new Response("Falha ao ler", { status: 500 });
        if (row.processed_at) return new Response("ok");

        const ok = await processEvent(db, row);
        // Recover older unfinished work on each call (bounded, fair ordering).
        await processPending(db, 3).catch((e) => console.error("whatsapp recovery failed", e));
        return ok ? new Response("ok") : new Response("Processamento pendente", { status: 503 });
      },
    },
  },
});
