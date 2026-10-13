import "server-only";

import { emailDomain, normalizeEmail } from "@/lib/email/rules";
import { logEvent } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProspectStatus } from "@/lib/types";

type SuppressionReason = "unsubscribe" | "not_interested" | "bounce" | "complaint" | "manual";

/** Add an address to the user's do-not-contact list (idempotent). */
export async function suppressEmail(userId: string, email: string, reason: SuppressionReason): Promise<void> {
  const db = createAdminClient();
  const e = normalizeEmail(email);
  const { error } = await db.from("suppression").insert({ user_id: userId, email: e, reason });
  if (error && error.code !== "23505") throw new Error(`Could not update the do-not-contact list (${error.code ?? "db error"}).`);
}

/**
 * Stop every unsent email to a prospect: drafts and scheduled steps become cancelled.
 * Messages already claimed by a running send job ('sending') can't be recalled.
 */
export async function cancelPendingMessages(userId: string, prospectId: string, reason: string): Promise<number> {
  const { data } = await createAdminClient()
    .from("messages")
    .update({ status: "cancelled", error: reason, scheduled_at: null })
    .eq("user_id", userId)
    .eq("prospect_id", prospectId)
    .in("status", ["draft", "scheduled"])
    .select("id");
  return data?.length ?? 0;
}

/** Hold unsent emails without cancelling them (out-of-office pause): scheduled → draft. */
export async function holdPendingMessages(userId: string, prospectId: string): Promise<void> {
  await createAdminClient()
    .from("messages")
    .update({ status: "draft", scheduled_at: null })
    .eq("user_id", userId)
    .eq("prospect_id", prospectId)
    .eq("status", "scheduled");
}

export async function setProspectStatus(userId: string, prospectId: string, status: ProspectStatus, extra: Record<string, unknown> = {}) {
  await createAdminClient().from("prospects").update({ status, ...extra }).eq("id", prospectId).eq("user_id", userId);
}

/**
 * Unsubscribe: suppress the address immediately, then stop every sequence to it across all of
 * this user's campaigns. Safe to call repeatedly (link scanners, double clicks, Gmail's button).
 */
export async function unsubscribe(userId: string, email: string, source: "link" | "reply"): Promise<void> {
  const db = createAdminClient();
  const e = normalizeEmail(email);
  await suppressEmail(userId, e, "unsubscribe");

  const { data: prospects } = await db
    .from("prospects")
    .select("id, status")
    .eq("user_id", userId)
    .eq("email", e);
  for (const p of prospects ?? []) {
    await cancelPendingMessages(userId, p.id, "Unsubscribed.");
    if (!["unsubscribed", "bounced"].includes(p.status)) await setProspectStatus(userId, p.id, "unsubscribed");
  }
  await logEvent(userId, "suppression.unsubscribed", { domain: emailDomain(e), source, prospects: prospects?.length ?? 0 });
}
