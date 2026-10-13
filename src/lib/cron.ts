import "server-only";

import { safeEqual } from "@/lib/crypto";

/**
 * Background job routes are public URLs, so each one requires
 * "Authorization: Bearer <CRON_SECRET>" (Vercel Cron sends exactly this when CRON_SECRET is set).
 * Without CRON_SECRET configured, every call is refused.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  return safeEqual(header, `Bearer ${secret}`);
}

export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

/** Run a job and report a small JSON summary (counts only, never data or secrets). */
export async function runJob(name: string, job: () => Promise<unknown>) {
  const started = Date.now();
  try {
    const result = await job();
    return Response.json({ job: name, ok: true, ms: Date.now() - started, result });
  } catch (e) {
    console.error(`[cron:${name}]`, e instanceof Error ? e.message : "error");
    return Response.json({ job: name, ok: false, ms: Date.now() - started }, { status: 500 });
  }
}
