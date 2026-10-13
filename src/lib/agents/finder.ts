import "server-only";

import { logEvent } from "@/lib/events";
import { isExcluded, type SearchPlan } from "@/lib/icp";
import { getLeadProvider, type Lead } from "@/lib/leads";
import { isRoleAddress, isSuppressed, normalizeEmail, type SuppressionEntry } from "@/lib/email/rules";
import { createAdminClient } from "@/lib/supabase/admin";

/** What campaigns.search_plan_json holds: the plan plus the provider's paging cursor. */
export type StoredSearchPlan = SearchPlan & { provider: string; next_page: number; exhausted: boolean };

export type FinderResult = {
  added: number;
  provider: string;
  exhausted: boolean;
  skipped: { duplicate: number; suppressed: number; role_address: number; excluded: number; active_elsewhere: number; no_email: number };
};

const PER_PAGE = 25;
const MAX_PAGES_PER_RUN = 3;

/**
 * Pull up to `limit` new prospects for a campaign. Idempotent: re-running never inserts the same
 * person twice (unique indexes + source_ref check), and paging resumes where the last run stopped.
 * Runs with the service role because users may not insert prospects directly; every query is
 * scoped to the campaign owner's user_id.
 */
export async function runFinder(userId: string, campaignId: string, limit = 25): Promise<FinderResult> {
  const db = createAdminClient();
  const provider = getLeadProvider();

  const { data: campaign, error } = await db
    .from("campaigns")
    .select("id, user_id, search_plan_json, icp_approved_at")
    .eq("id", campaignId)
    .eq("user_id", userId)
    .single();
  if (error || !campaign) throw new Error("Campaign not found.");
  if (!campaign.icp_approved_at || !campaign.search_plan_json) throw new Error("Approve the target profile first.");

  const stored = campaign.search_plan_json as StoredSearchPlan;
  // Restart paging if the provider changed (e.g. an Apollo key was added after trying the demo).
  let page = stored.provider === provider.id ? Math.max(1, stored.next_page || 1) : 1;
  let exhausted = stored.provider === provider.id ? Boolean(stored.exhausted) : false;

  // Everything we need to filter against, loaded once.
  const [{ data: suppression }, { data: existing }, { data: activeElsewhere }] = await Promise.all([
    db.from("suppression").select("email, domain").eq("user_id", userId),
    db.from("prospects").select("email, source_ref").eq("campaign_id", campaignId).eq("user_id", userId),
    db.from("prospects").select("email").eq("user_id", userId).in("status", ["active", "paused"]).neq("campaign_id", campaignId),
  ]);
  const suppressed = (suppression ?? []) as SuppressionEntry[];
  const seenEmails = new Set((existing ?? []).map((p) => p.email).filter(Boolean) as string[]);
  const seenRefs = new Set((existing ?? []).map((p) => p.source_ref).filter(Boolean) as string[]);
  const busy = new Set((activeElsewhere ?? []).map((p) => p.email).filter(Boolean) as string[]);

  const result: FinderResult = {
    added: 0,
    provider: provider.label,
    exhausted,
    skipped: { duplicate: 0, suppressed: 0, role_address: 0, excluded: 0, active_elsewhere: 0, no_email: 0 },
  };

  for (let i = 0; i < MAX_PAGES_PER_RUN && !exhausted && result.added < limit; i++) {
    const { leads, hasMore } = await provider.search(stored, { page, perPage: PER_PAGE });
    page += 1;
    exhausted = !hasMore;

    for (const lead of leads) {
      if (result.added >= limit) break;
      const reason = skipReason(lead, stored, { suppressed, seenEmails, seenRefs, busy });
      if (reason) {
        result.skipped[reason]++;
        continue;
      }
      const email = normalizeEmail(lead.email!);
      const { error: insertError } = await db.from("prospects").insert({
        user_id: userId,
        campaign_id: campaignId,
        name: lead.name,
        first_name: lead.first_name,
        title: lead.title,
        company: lead.company,
        domain: lead.domain,
        linkedin_url: lead.linkedin_url,
        location: lead.location,
        timezone: lead.timezone,
        email,
        source: lead.source,
        source_ref: lead.source_ref,
        is_demo: lead.is_demo,
        status: "new",
      });
      if (insertError) {
        // 23505 = unique violation: someone else inserted it first. Anything else is a real error.
        if (insertError.code === "23505") result.skipped.duplicate++;
        else throw new Error(`Could not save prospects (${insertError.code ?? "db error"}).`);
        continue;
      }
      seenEmails.add(email);
      seenRefs.add(lead.source_ref);
      result.added++;
    }
  }

  // Save the paging cursor so the next run continues where this one stopped.
  await db
    .from("campaigns")
    .update({ search_plan_json: { ...stored, provider: provider.id, next_page: page, exhausted } })
    .eq("id", campaignId)
    .eq("user_id", userId);

  result.exhausted = exhausted;
  await logEvent(userId, "finder.run", { campaign_id: campaignId, provider: provider.id, added: result.added, skipped: result.skipped });
  return result;
}

type SkipReason = keyof FinderResult["skipped"];

export function skipReason(
  lead: Lead,
  plan: SearchPlan,
  ctx: { suppressed: SuppressionEntry[]; seenEmails: Set<string>; seenRefs: Set<string>; busy: Set<string> },
): SkipReason | null {
  if (!lead.email) return "no_email";
  const email = normalizeEmail(lead.email);
  if (ctx.seenEmails.has(email) || ctx.seenRefs.has(lead.source_ref)) return "duplicate";
  if (isSuppressed(email, ctx.suppressed)) return "suppressed";
  if (isRoleAddress(email)) return "role_address";
  if (isExcluded(plan.exclusions, lead)) return "excluded";
  if (ctx.busy.has(email)) return "active_elsewhere";
  return null;
}
