import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
export const Route = createFileRoute("/api/public/whatsapp/worker")({ server: { handlers: {
  POST: async ({ request }) => {
    const denied = await authenticateCronRequest(request);
    if (denied) return denied;
    const { getAdmin, processPending } = await import("@/lib/whatsapp/process.server");
    await processPending(await getAdmin(), 5);
    return Response.json({ ok: true });
  },
} } });