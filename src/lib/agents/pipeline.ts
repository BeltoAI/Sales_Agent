import "server-only";

import { logEvent } from "@/lib/events";
import { senderFromProfile } from "@/lib/sender";
import { getVerifier } from "@/lib/verify";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Prospect } from "@/lib/types";
import { researchProspect } from "./researcher";
import { writeForProspect } from "./writer";

export type PipelineResult = { processed: number; invalid: number; written: number; generic: number; failed: number; remaining: number };

/**
 * Advance "new" prospects of a campaign: verify email → research → write emails.
 * Verification runs first so no AI money is spent on undeliverable addresses. Stops starting new work once
 * `budgetMs` has elapsed so each serverless run stays inside its time limit. Safe to re-run:
 * research is skipped when already done, and the writer won't duplicate messages.
 */
export async function processNewProspects(
  userId: string,
  campaignId: string,
  { budgetMs = 40_000, max = 5 }: { budgetMs?: number; max?: number } = {},
): Promise<PipelineResult> {
  const started = Date.now();
  const db = createAdminClient();

  const { data: profile } = await db.from("profiles").select("*").eq("user_id", userId).single<Profile>();
  if (!profile) throw new Error("Finish onboarding first.");
  const sender = senderFromProfile(profile);

  const { data } = await db
    .from("prospects")
    .select("*")
    .eq("user_id", userId)
    .eq("campaign_id", campaignId)
    .eq("status", "new")
    .not("email", "is", null)
    .order("created_at", { ascending: true })
    .limit(max);
  const prospects = (data ?? []) as Prospect[];

  const result: PipelineResult = { processed: 0, invalid: 0, written: 0, generic: 0, failed: 0, remaining: 0 };
  const verifier = getVerifier();
  for (const p of prospects) {
    if (Date.now() - started > budgetMs) break;
    result.processed++;
    try {
      let prospect = p;
      // Verify (demo prospects are never verified as valid; the sender blocks them anyway).
      if (!p.is_demo && p.email_status === "unchecked" && p.email) {
        const v = await verifier.verify(p.email);
        const patch = { email_status: v.status, email_checked_at: new Date().toISOString(), email_check_provider: v.provider };
        if (v.status !== "valid") {
          await db.from("prospects").update({ ...patch, status: "excluded" }).eq("id", p.id).eq("user_id", userId).eq("status", "new");
          await logEvent(userId, "verifier.rejected", { prospect_id: p.id, status: v.status, reason: v.reason });
          result.invalid++;
          continue;
        }
        await db.from("prospects").update(patch).eq("id", p.id).eq("user_id", userId);
        prospect = { ...prospect, ...patch };
      }
      if (!p.researched_at) {
        const r = await researchProspect(p);
        prospect = { ...prospect, research_notes: r.notes, personal_detail: r.detail, research_source_url: r.sourceUrl, researched_at: new Date().toISOString() };
      }
      const w = await writeForProspect(sender, prospect);
      if (w.ok) {
        result.written++;
        if (w.generic) result.generic++;
      } else {
        // Don't retry forever: park it (the prospect page offers "Rewrite emails").
        result.failed++;
        await db.from("prospects").update({ status: "excluded" }).eq("id", p.id).eq("user_id", userId).eq("status", "new");
      }
    } catch (e) {
      result.failed++;
      await logEvent(userId, "pipeline.error", { prospect_id: p.id, error: e instanceof Error ? e.message.slice(0, 200) : "error" });
      // AI/config errors affect every prospect; stop this run instead of burning through the batch.
      break;
    }
  }

  const { count } = await db
    .from("prospects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("campaign_id", campaignId)
    .eq("status", "new");
  result.remaining = count ?? 0;
  return result;
}
