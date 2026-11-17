import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getWhatsAppConnection = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("wa_accounts").select("active,display_phone_number").eq("user_id", context.userId).maybeSingle();
  if (error) throw new Error("Não foi possível carregar a conexão.");
  const appId = process.env["META_APP_ID"];
  const configId = process.env["META_CONFIG_ID"];
  const configured = Boolean(appId && configId && process.env["META_APP_SECRET"] && process.env["META_WEBHOOK_VERIFY_TOKEN"]);
  return { configured, appId: appId ?? "", configId: configId ?? "", connected: Boolean(data?.active), phone: data?.display_phone_number ?? "" };
});

export const completeWhatsAppConnection = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(1).max(4096), phoneNumberId: z.string().regex(/^\d{5,30}$/), wabaId: z.string().regex(/^\d{5,30}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { encryptToken, metaRequest, META_VERSION } = await import("./meta.server");
    const appId = process.env["META_APP_ID"], appSecret = process.env["META_APP_SECRET"];
    if (!appId || !appSecret) throw new Error("A conexão com a Meta ainda não foi configurada.");
    const form = new URLSearchParams({ client_id: appId, client_secret: appSecret, code: data.code });
    const response = await fetch(`https://graph.facebook.com/${META_VERSION}/oauth/access_token`, { method: "POST", body: form });
    const result = await response.json() as { access_token?: string; error?: { message?: string } };
    if (!response.ok || !result.access_token) throw new Error(`Meta (${response.status}): ${result.error?.message ?? "Não foi possível autorizar a conexão."}`);
    const token = result.access_token;
    const numbers = await metaRequest(`${data.wabaId}/phone_numbers?fields=id,display_phone_number`, token);
    const phone = numbers.data?.find((p) => p.id === data.phoneNumberId);
    if (!phone) throw new Error("O número não pertence à conta autorizada.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: lookupError } = await supabaseAdmin.from("wa_accounts").select("user_id").eq("phone_number_id", phone.id).maybeSingle();
    if (lookupError) throw new Error("Não foi possível verificar o número.");
    if (existing && existing.user_id !== context.userId) throw new Error("Este número já pertence a outra conta do iAgenda.");
    // Persist before subscribing, so immediately delivered callbacks can be attributed.
    const { error } = await supabaseAdmin.from("wa_accounts").upsert({ user_id: context.userId, phone_number_id: phone.id, waba_id: data.wabaId, token_ciphertext: encryptToken(token), display_phone_number: phone.display_phone_number ?? "", active: false }, { onConflict: "user_id" });
    if (error) throw new Error("Não foi possível salvar a conexão.");
    await metaRequest(`${data.wabaId}/subscribed_apps`, token, "POST");
    const { error: activationError } = await supabaseAdmin.from("wa_accounts").update({ active: true }).eq("user_id", context.userId);
    if (activationError) throw new Error("Não foi possível ativar a conexão.");
    return { ok: true };
  });

export const disconnectWhatsApp = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("wa_accounts").select("waba_id,token_ciphertext").eq("user_id", context.userId).maybeSingle();
  if (error) throw new Error("Não foi possível carregar a conexão.");
  if (data) {
    const { decryptToken, metaRequest } = await import("./meta.server");
    const { data: others, error: othersError } = await supabaseAdmin.from("wa_accounts").select("user_id").eq("waba_id", data.waba_id).neq("user_id", context.userId).eq("active", true);
    if (othersError) throw new Error("Não foi possível verificar a conexão.");
    if (!others?.length) await metaRequest(`${data.waba_id}/subscribed_apps`, decryptToken(data.token_ciphertext), "DELETE");
    const { error: removeError } = await supabaseAdmin.from("wa_accounts").delete().eq("user_id", context.userId);
    if (removeError) throw new Error("Não foi possível desconectar.");
  }
  return { ok: true };
});