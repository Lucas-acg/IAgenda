import { z } from "zod";

const ITERATIONS = 310_000;
const envelopeSchema = z.object({
  format: z.literal("iagenda-encrypted"), version: z.literal(1),
  cipher: z.literal("AES-GCM"), kdf: z.literal("PBKDF2-SHA256"),
  iterations: z.literal(ITERATIONS), salt: z.string().max(32), iv: z.string().max(24),
  ciphertext: z.string().max(30_000_000),
});
const encode = (bytes: Uint8Array) => {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
};
const decode = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
async function key(password: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function encryptBackup(data: unknown, password: string) {
  if (password.length < 8) throw new Error("Use pelo menos 8 caracteres na senha do backup.");
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(password, salt), new TextEncoder().encode(JSON.stringify(data)));
  return JSON.stringify({ format: "iagenda-encrypted", version: 1, cipher: "AES-GCM", kdf: "PBKDF2-SHA256", iterations: ITERATIONS, salt: encode(salt), iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) });
}
export function isEncryptedBackup(data: unknown) { return typeof data === "object" && data !== null && "format" in data && data.format === "iagenda-encrypted"; }
export async function decryptBackup(data: unknown, password: string): Promise<unknown> {
  const parsed = envelopeSchema.parse(data);
  const salt = decode(parsed.salt), iv = decode(parsed.iv);
  if (salt.length !== 16 || iv.length !== 12) throw new Error("Backup inválido.");
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await key(password, salt), decode(parsed.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}