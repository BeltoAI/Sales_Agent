import "server-only";

import { isRoleAddress } from "@/lib/email/rules";
import { logEvent } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Prospect } from "@/lib/types";
import { nextBusinessSlot, safeTimezone } from "./schedule";

export type ScheduleResult = { started: number; skipped: number };

/**
 * Start sequences for "ready" prospects of a running campaign: schedule step 1 at a random moment
 * in the recipient's business hours and mark the prospect active. Only verified-valid, non-role
 * addresses are started (demo prospects are started too, so the flow is visible, and the sender
 * then cancels them). Activation is where "one active campaign per person" is enforced by the
 * database; a conflict parks the prospect instead of emailing twice.
 */
export async function startReadyProspects(userId: string, campaignId: string, limit = 50): Promise<ScheduleResult> {
  const db = createAdminClient();
  const [{ data: campaign }, { data: profile }] = await Promise.all([
    db.from("campaigns").select("id, status, mailbox_id").eq("id", campaignId).eq("user_id", userId).single(),
    db.from("profiles").select("timezone").eq("user_id", userId).single<Pick<Profile, "timezone">>(),
  ]);
  const result: ScheduleResult = { started: 0, skipped: 0 };
  if (!campaign || campaign.status !== "running" || !campaign.mailbox_id) return result;

  const { data } = await db
    .from("prospects")
    .select("*")
    .eq("user_id", userId)
    .eq("campaign_id", campaignId)
    .eq("status", "ready")
    .order("created_at")
    .limit(limit);

  const now = new Date();
  for (const p of (data ?? []) as Prospect[]) {
    const sendable = p.is_demo || (p.email && p.email_status === "valid" && !isRoleAddress(p.email));
    if (!sendable) {
      await db.from("prospects").update({ status: "excluded" }).eq("id", p.id).eq("user_id", userId).eq("status", "ready");
      result.skipped++;
      continue;
    }
    const { error } = await db.from("prospects").update({ status: "active" }).eq("id", p.id).eq("user_id", userId).eq("status", "ready");
    if (error) {
      // 23505: already active in another campaign.
      await db.from("prospects").update({ status: "excluded" }).eq("id", p.id).eq("user_id", userId).eq("status", "ready");
      await logEvent(userId, "scheduler.skipped", { prospect_id: p.id, reason: error.code === "23505" ? "active in another campaign" : "db error" });
      result.skipped++;
      continue;
    }
    const tz = safeTimezone(p.timezone, safeTimezone(profile?.timezone));
    const { data: updated } = await db
      .from("messages")
      .update({ status: "scheduled", scheduled_at: nextBusinessSlot(now, tz).toISOString(), mailbox_id: campaign.mailbox_id, error: null })
      .eq("prospect_id", p.id)
      .eq("user_id", userId)
      .eq("step", 1)
      .eq("status", "draft")
      .select("id");
    if (!updated?.length) {
      // No step-1 draft: put the prospect back so nothing half-starts.
      await db.from("prospects").update({ status: "ready" }).eq("id", p.id).eq("user_id", userId).eq("status", "active");
      result.skipped++;
      continue;
    }
    result.started++;
  }
  if (result.started || result.skipped) await logEvent(userId, "scheduler.started", { campaign_id: campaignId, ...result });
  return result;
}

/**
 * Re-spread scheduled messages of a campaign (e.g. after it was paused for a while), so they
 * don't all fire at once on resume.
 */
export async function respreadScheduled(userId: string, campaignId: string): Promise<number> {
  const db = createAdminClient();
  const [{ data: msgs }, { data: profile }] = await Promise.all([
    db.from("messages").select("id, prospect_id, scheduled_at").eq("user_id", userId).eq("campaign_id", campaignId).eq("status", "scheduled"),
    db.from("profiles").select("timezone").eq("user_id", userId).single<Pick<Profile, "timezone">>(),
  ]);
  if (!msgs?.length) return 0;
  const { data: prospects } = await db.from("prospects").select("id, timezone").in("id", msgs.map((m) => m.prospect_id));
  const tzById = new Map((prospects ?? []).map((p) => [p.id, p.timezone as string | null]));
  const now = new Date();
  let n = 0;
  for (const m of msgs) {
    if (m.scheduled_at && new Date(m.scheduled_at) > now) continue; // still in the future: keep
    const tz = safeTimezone(tzById.get(m.prospect_id), safeTimezone(profile?.timezone));
    await db.from("messages").update({ scheduled_at: nextBusinessSlot(now, tz).toISOString() }).eq("id", m.id).eq("status", "scheduled");
    n++;
  }
  return n;
}
