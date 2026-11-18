import { createFileRoute } from "@tanstack/react-router";

// Called by the signed-in owner from the Telegram tab to inspect pending messages.
export const Route = createFileRoute("/api/public/whatsapp/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "Não autenticado" }, { status: 401 });
        const { getAdmin, analyzePendingMessages } = await import("@/lib/whatsapp/process.server");
        const db = await getAdmin();
        const { data, error } = await db.auth.getUser(token);
        if (error || !data.user) return Response.json({ error: "Não autenticado" }, { status: 401 });
        try {
          const count = await analyzePendingMessages(db, data.user.id);
          return Response.json({ analyzed: count });
        } catch (e) {
          console.error("Telegram analyze failed", e);
          return Response.json({ error: "Não foi possível analisar agora." }, { status: 500 });
        }
      },
    },
  },
});
