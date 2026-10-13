import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Append to the audit log. Payloads hold IDs, counts and short summaries only:
 * never passwords, keys, tokens, email bodies or raw API responses.
 * Logging never breaks the action that triggered it.
 */
export async function logEvent(userId: string, type: string, payload: Record<string, unknown> = {}): Promise<void> {
  try {
    const { error } = await createAdminClient().from("events").insert({ user_id: userId, type, payload });
    if (error) console.error(`[events] could not log "${type}": ${error.code ?? "error"}`);
  } catch (e) {
    console.error(`[events] could not log "${type}": ${e instanceof Error ? e.name : "error"}`);
  }
}
