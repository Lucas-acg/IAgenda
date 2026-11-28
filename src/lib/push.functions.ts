import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pushSubscriptionSchema, trustedPushEndpoint } from "./push-validation";
import { z } from "zod";

export const getWebPushPublicKey = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  const { webPushKeys } = await import("./push-keys.server");
  return { publicKey: (await webPushKeys()).publicKey };
});
export const savePushSubscription = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pushSubscriptionSchema.parse(input)).handler(async ({ data, context }) => {
    const result = await context.supabase.from("push_subscriptions").upsert({ user_id: context.userId, endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth }, { onConflict: "user_id,endpoint" });
    if (result.error) throw new Error("Não foi possível registrar este dispositivo.");
    return { ok: true };
  });
export const removePushSubscription = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ endpoint: z.string().max(4096) }).parse(input)).handler(async ({ data, context }) => {
    const result = await context.supabase.from("push_subscriptions").delete().eq("user_id", context.userId).eq("endpoint", data.endpoint);
    if (result.error) throw new Error("Não foi possível desativar os avisos.");
    return { ok: true };
  });
export const sendTestPush = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ endpoint: z.string().refine(trustedPushEndpoint) }).parse(input)).handler(async ({ data, context }) => {
    const result = await context.supabase.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", context.userId).eq("endpoint", data.endpoint).single();
    if (result.error) throw new Error("Ative os avisos neste dispositivo primeiro.");
    const { deliverPush } = await import("./push-send.server");
    const status = await deliverPush(result.data, { title: "IAgenda", body: "Os avisos dos seus hábitos estão ativados neste dispositivo.", tag: "iagenda-push-test", url: "/" });
    if (status < 200 || status >= 300) throw new Error("Não foi possível entregar o aviso. Reative este dispositivo.");
    return { ok: true };
  });