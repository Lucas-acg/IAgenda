import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import type { Json } from "@/integrations/supabase/types";
import { telegramMessage } from "@/lib/whatsapp/telegram";

// Preserve the existing URL and durable inbox; only the transport changes.
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: { handlers: {
    POST: async ({ request }) => {
      const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];
      if (!secret) return new Response("Telegram não configurado", { status: 503 });
      const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
      const left = Buffer.from(actual), right = Buffer.from(secret);
      if (left.length !== right.length || !timingSafeEqual(left, right)) return new Response("Não autorizado", { status: 401 });
      const reader = request.body?.getReader();
      if (!reader) return new Response("Corpo ausente", { status: 400 });
      const chunks: Uint8Array[] = []; let bytes = 0;
      for (;;) {
        const part = await reader.read(); if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 64 * 1024) { await reader.cancel(); return new Response("Corpo muito grande", { status: 413 }); }
        chunks.push(part.value);
      }
      let payload: unknown;
      try { payload = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
      catch { return new Response("JSON inválido", { status: 400 }); }
      const message = telegramMessage(payload);
      if (!message) return Response.json({ ok: true, ignored: true });
      const { getAdmin, processPending } = await import("@/lib/whatsapp/process.server");
      const { enqueueProcessing } = await import("@/lib/whatsapp/background.server");
      const db = await getAdmin();
      const { error } = await db.from("whatsapp_webhook_events").upsert({ delivery_id: `telegram-${message.updateId}`, event: "telegram.message", payload: payload as Json }, { onConflict: "delivery_id", ignoreDuplicates: true });
      if (error) return new Response("Falha ao gravar", { status: 500 });
      await enqueueProcessing(() => processPending(db, 5));
      return Response.json({ ok: true });
    },
  } },
});
