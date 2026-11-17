import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

export const META_VERSION = "v27.0";
function encryptionKey() {
  const secret = process.env["META_TOKEN_ENCRYPTION_SECRET"];
  if (!secret) throw new Error("Proteção das credenciais não configurada.");
  return createHash("sha256").update(secret).digest();
}
export function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token), cipher.final()]);
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString("base64");
}
export function decryptToken(value: string) {
  const buf = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(-16));
  return Buffer.concat([decipher.update(buf.subarray(12, -16)), decipher.final()]).toString("utf8");
}
export async function metaRequest(path: string, token: string, method = "GET") {
  const res = await fetch(`https://graph.facebook.com/${META_VERSION}/${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json() as { error?: { message?: string }; success?: boolean; data?: { id: string; display_phone_number?: string }[]; id?: string; display_phone_number?: string };
  if (!res.ok || body.error) throw new Error(`Meta (${res.status}): ${body.error?.message ?? "Não foi possível concluir a operação."}`);
  return body;
}