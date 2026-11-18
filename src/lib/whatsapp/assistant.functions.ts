import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LINK_CODE_LIFETIME_MS } from "./extract";

export const assistantStatus = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const botUsername = process.env["TELEGRAM_BOT_USERNAME"] ?? "IAgenda2_bot";
  const configured = Boolean(botUsername && process.env["TELEGRAM_BOT_TOKEN"] && process.env["TELEGRAM_WEBHOOK_SECRET"]);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: control, error: controlError } = await supabaseAdmin.from("wa_processing_control").select("paused_reason").eq("id", 1).maybeSingle();
  if (controlError) throw new Error("Não foi possível verificar o assistente.");
  const { data, error } = await context.supabase.from("wa_phone_links").select("phone,linked_at").eq("user_id", context.userId).maybeSingle();
  if (error) throw new Error("Não foi possível carregar o vínculo.");
  return { configured: configured && !control?.paused_reason, paused: Boolean(control?.paused_reason), botUsername, linkedPhone: data?.phone ?? null };
});

export const generateLinkCode = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  if (!process.env["TELEGRAM_BOT_TOKEN"] || !process.env["TELEGRAM_WEBHOOK_SECRET"]) throw new Error("O bot ainda não está configurado.");
  const { randomBytes, createHash } = await import("node:crypto");
  const code = randomBytes(8).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + LINK_CODE_LIFETIME_MS).toISOString();
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