import "server-only";

import { AI_MODEL, factCheck, writeSequence, type DraftEmail, type FactCheckResult, type SenderContext } from "@/lib/ai";
import { isWithinWordLimit, MAX_BODY_WORDS, wordCount } from "@/lib/email/rules";
import { logEvent } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Prospect } from "@/lib/types";

/** Plain text only: no HTML tags, no markdown links. */
export function looksLikePlainText(body: string): boolean {
  return !/<\/?[a-z][^>]*>/i.test(body) && !/\]\(https?:/i.test(body);
}

/** Problems with a set of drafts that must be fixed before they can be saved. */
export function draftProblems(drafts: DraftEmail[]): string[] {
  const problems: string[] = [];
  for (const d of drafts) {
    if (!isWithinWordLimit(d.body)) problems.push(`Email ${d.step} has ${wordCount(d.body)} words; it must be under ${MAX_BODY_WORDS}.`);
    if (!looksLikePlainText(d.body)) problems.push(`Email ${d.step} contains HTML or markdown; use plain text.`);
    if (!d.subject.trim()) problems.push(`Email ${d.step} has no subject.`);
    if (!d.body.trim()) problems.push(`Email ${d.step} is empty.`);
  }
  return problems;
}

type Attempt = { drafts: DraftEmail[]; checks: FactCheckResult[]; generic: boolean };

/** Write → check length/format (one retry) → fact check. Returns null if it can't pass. */
async function attempt(
  sender: SenderContext,
  prospect: Prospect,
  generic: boolean,
): Promise<Attempt | { failed: string }> {
  const base = {
    sender,
    prospect: { first_name: prospect.first_name, name: prospect.name, title: prospect.title, company: prospect.company },
    researchNotes: prospect.research_notes,
    personalDetail: prospect.personal_detail,
    generic,
  };
  let drafts = await writeSequence(base);
  let problems = draftProblems(drafts);
  if (problems.length) {
    drafts = await writeSequence({ ...base, feedback: problems.join(" ") });
    problems = draftProblems(drafts);
    if (problems.length) return { failed: problems.join(" ") };
  }
  const checks = await factCheck({
    sender,
    prospect: { name: prospect.name, title: prospect.title, company: prospect.company },
    researchNotes: generic ? null : prospect.research_notes,
    emails: drafts,
  });
  if (checks.some((c) => !c.supported)) {
    return { failed: `Unsupported claims: ${checks.flatMap((c) => c.unsupported_claims).slice(0, 3).join("; ")}` };
  }
  return { drafts, checks, generic };
}

export type WriteOutcome = { ok: true; generic: boolean } | { ok: false; reason: string };

/**
 * Write the 3-step sequence for a researched prospect and save it as drafts.
 * Safety: emails must be under 120 words, plain text, and pass the fact check against research_notes.
 * If the personalised version fails the fact check, a generic honest version is written instead;
 * if that fails too, nothing is saved (fail closed).
 * Idempotent: does nothing if this prospect already has messages, unless `replaceDrafts` is set and
 * every existing message is still an unsent draft.
 */
export async function writeForProspect(
  sender: SenderContext,
  prospect: Prospect,
  { replaceDrafts = false }: { replaceDrafts?: boolean } = {},
): Promise<WriteOutcome> {
  const db = createAdminClient();
  const { data: existing } = await db
    .from("messages")
    .select("id, status")
    .eq("prospect_id", prospect.id)
    .eq("user_id", prospect.user_id);
  if (existing?.length) {
    if (!replaceDrafts) return { ok: true, generic: false };
    if (existing.some((m) => m.status !== "draft")) return { ok: false, reason: "Emails already scheduled or sent; they can't be rewritten." };
  }

  const thin = !prospect.research_notes;
  let result = await attempt(sender, prospect, thin);
  if ("failed" in result && !thin) {
    // Personalised version didn't pass: fall back to an honest generic email.
    result = await attempt(sender, prospect, true);
  }
  if ("failed" in result) {
    await logEvent(prospect.user_id, "writer.failed", { prospect_id: prospect.id, reason: result.failed.slice(0, 300) });
    return { ok: false, reason: result.failed };
  }

  const { drafts, checks, generic } = result;
  const checkedAt = new Date().toISOString();
  const rows = drafts.map((d) => {
    const check = checks.find((c) => c.step === d.step)!;
    return {
      user_id: prospect.user_id,
      prospect_id: prospect.id,
      campaign_id: prospect.campaign_id,
      step: d.step,
      subject: d.subject,
      body: d.body,
      status: "draft" as const,
      fact_check: { supported: check.supported, unsupported_claims: check.unsupported_claims, generic, model: AI_MODEL, checked_at: checkedAt },
    };
  });

  if (existing?.length) {
    for (const row of rows) {
      await db
        .from("messages")
        .update({ subject: row.subject, body: row.body, fact_check: row.fact_check })
        .eq("prospect_id", prospect.id)
        .eq("user_id", prospect.user_id)
        .eq("step", row.step)
        .eq("status", "draft");
    }
  } else {
    // unique (prospect_id, step) makes a concurrent duplicate run fail here instead of double-writing.
    const { error } = await db.from("messages").insert(rows);
    if (error && error.code !== "23505") throw new Error(`Could not save emails (${error.code ?? "db error"}).`);
  }

  // new → ready (also a prospect parked after a failed write). Never touches started sequences.
  await db
    .from("prospects")
    .update({ status: "ready" })
    .eq("id", prospect.id)
    .eq("user_id", prospect.user_id)
    .in("status", ["new", "excluded"])
    .neq("email_status", "invalid");
  await logEvent(prospect.user_id, "writer.done", { prospect_id: prospect.id, generic });
  return { ok: true, generic };
}
