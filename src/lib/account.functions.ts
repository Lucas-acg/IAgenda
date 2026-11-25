import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Permanently deletes the caller's data and account. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const { data: photos, error: photosError } = await context.supabase.storage.from("profile-photos").list(userId);
    if (photosError) throw new Error("Não foi possível acessar as fotos.");
    if (photos.length) {
      const { error: removeError } = await context.supabase.storage.from("profile-photos").remove(photos.map((p) => `${userId}/${p.name}`));
      if (removeError) throw new Error("Não foi possível apagar as fotos.");
    }
    for (const t of ["appointments", "entries", "habits", "habit_routines", "reminders", "important_days", "preferences", "profiles"] as const) {
      const { error } = await supabaseAdmin.from(t).delete().eq("user_id", userId);
      if (error) throw new Error("Não foi possível apagar os dados.");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error("Não foi possível excluir a conta.");
    return { ok: true };
  });
