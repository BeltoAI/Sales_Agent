import "server-only";

import { deriveKey, safeEqual, sign } from "@/lib/crypto";
import { normalizeEmail } from "@/lib/email/rules";

/**
 * Unsubscribe links: /u/<payload>.<signature>
 * payload = base64url(JSON {u: user id, e: email}); signature = HMAC-SHA256 with a key derived from
 * ENCRYPTION_KEY. Unforgeable, so nobody can unsubscribe someone else by editing the link,
 * and no login is needed to use it.
 */

type Payload = { u: string; e: string };

const key = () => deriveKey("unsubscribe-v1");

export function createUnsubscribeToken(userId: string, email: string): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, e: normalizeEmail(email) } satisfies Payload)).toString("base64url");
  return `${payload}.${sign(payload, key())}`;
}

export function verifyUnsubscribeToken(token: string): { userId: string; email: string } | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined || token.length > 1000) return null;
  if (!safeEqual(signature, sign(payload, key()))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<Payload>;
    if (typeof data.u !== "string" || typeof data.e !== "string" || !data.e.includes("@")) return null;
    return { userId: data.u, email: normalizeEmail(data.e) };
  } catch {
    return null;
  }
}

/** Public base URL for links in emails. */
export function appBaseUrl(): string | null {
  const explicit = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return process.env.NODE_ENV === "production" ? null : "http://localhost:3000";
}

export function unsubscribeUrl(userId: string, email: string): string | null {
  const base = appBaseUrl();
  return base ? `${base}/u/${createUnsubscribeToken(userId, email)}` : null;
}
