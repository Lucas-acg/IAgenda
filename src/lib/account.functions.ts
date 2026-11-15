import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Permanently deletes the caller's data and account. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    for (const t of ["appointments", "entries", "habits", "reminders", "important_days", "preferences", "profiles"] as const) {
      const { error } = await supabaseAdmin.from(t).delete().eq("user_id", userId);
      if (error) throw new Error("Não foi possível apagar os dados.");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error("Não foi possível excluir a conta.");
    return { ok: true };
  });
