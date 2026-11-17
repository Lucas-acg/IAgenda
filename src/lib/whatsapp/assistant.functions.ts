import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const assistantStatus = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const phone = process.env["WHATSAPP_OFFICIAL_NUMBER"] ?? "";
  const configured = Boolean(phone && process.env["WHATSAPP_API_KEY"]);
  const { data, error } = await context.supabase.from("wa_phone_links").select("phone,linked_at").eq("user_id", context.userId).maybeSingle();
  if (error) throw new Error("Não foi possível carregar o vínculo.");
  return { configured, officialNumber: phone.replace(/\D/g, ""), linkedPhone: data?.phone ?? null };
});

export const generateLinkCode = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  if (!process.env["WHATSAPP_API_KEY"] || !process.env["WHATSAPP_OFFICIAL_NUMBER"]) throw new Error("O número oficial ainda não está configurado.");
  const { randomBytes, createHash } = await import("node:crypto");
  const code = randomBytes(8).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("wa_link_codes").upsert({ user_id: context.userId, code_hash: createHash("sha256").update(code).digest("hex"), expires_at: expiresAt }, { onConflict: "user_id" });
  if (error) throw new Error("Não foi possível gerar o código.");
  return { code, expiresAt };
});

export const unlinkPhone = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (const table of ["wa_phone_links", "wa_link_codes"] as const) {
    const { error } = await supabaseAdmin.from(table).delete().eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível desvincular o telefone.");
  }
  return { ok: true };
});