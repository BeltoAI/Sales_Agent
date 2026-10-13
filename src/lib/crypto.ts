import "server-only";

import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { MissingEnvError } from "@/lib/env";

/**
 * AES-256-GCM encryption for stored mailbox credentials.
 * Format: "v1:<iv>:<tag>:<ciphertext>" (base64). The "aad" (e.g. the owner's user id) is bound into
 * the authentication tag, so a ciphertext copied to another user's row will not decrypt.
 */

const VERSION = "v1";

/** The 32-byte master key from ENCRYPTION_KEY (base64, or 64 hex chars). Never logged. */
export function masterKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) throw new MissingEnvError("ENCRYPTION_KEY");
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (generate one with: openssl rand -base64 32).");
  }
  return key;
}

/** A separate key for a separate purpose, derived from the master key (so one secret serves both). */
export function deriveKey(purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", masterKey(), Buffer.alloc(0), `sales-agent:${purpose}`, 32));
}

export function encrypt(plaintext: string, aad: string, key: Buffer = masterKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(":");
}

export function decrypt(payload: string, aad: string, key: Buffer = masterKey()): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== VERSION || !ivB64 || !tagB64 || dataB64 === undefined) {
    throw new Error("Unrecognised encrypted credential format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  try {
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Could not decrypt credentials (wrong ENCRYPTION_KEY or tampered data).");
  }
}

/** HMAC-SHA256, base64url. */
export function sign(data: string, key: Buffer): string {
  return createHmac("sha256", key).update(data).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
