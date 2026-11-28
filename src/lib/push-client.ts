import { removePushSubscription } from "./push.functions";

export const PUSH_WORKER = "/habit-notifications-sw.js";
export async function currentPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration?.active?.scriptURL.endsWith(PUSH_WORKER)) return null;
  return registration.pushManager.getSubscription();
}
export async function disconnectDevicePush() {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await removePushSubscription({ data: { endpoint: subscription.endpoint } });
  await subscription.unsubscribe();
}
export function publicKeyBytes(key: string) {
  const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}