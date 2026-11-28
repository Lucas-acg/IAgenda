import { p256 } from "@noble/curves/nist.js";
import type { VapidKeys } from "@block65/webcrypto-web-push";

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export async function webPushKeys(): Promise<VapidKeys & { publicKey: string }> {
  const seed = process.env["WEB_PUSH_KEY_SEED"];
  if (!seed) throw new Error("Notificações ainda não configuradas.");
  const privateBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)));
  const publicBytes = p256.getPublicKey(privateBytes, false);
  return { privateKey: base64url(privateBytes), publicKey: base64url(publicBytes), subject: "https://ia-genda.lovable.app" };
}