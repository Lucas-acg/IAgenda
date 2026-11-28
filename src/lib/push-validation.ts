import { z } from "zod";

export function trustedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && (
      url.hostname === "fcm.googleapis.com" || url.hostname === "updates.push.services.mozilla.com" ||
      url.hostname === "web.push.apple.com" || url.hostname.endsWith(".push.apple.com") ||
      url.hostname === "wns.windows.com" || url.hostname.endsWith(".notify.windows.com")
    );
  } catch { return false; }
}
const base64url = z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/);
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().max(4096).refine(trustedPushEndpoint),
  keys: z.object({ p256dh: base64url.min(86).max(88), auth: base64url.min(22).max(24) }),
});