"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AiError } from "@/lib/ai";
import { researchProspect } from "@/lib/agents/researcher";
import { writeForProspect } from "@/lib/agents/writer";
import { requireProfile, requireUser } from "@/lib/auth";
import { isWithinWordLimit, MAX_BODY_WORDS, wordCount } from "@/lib/email/rules";
import { MissingEnvError } from "@/lib/env";
import { logEvent } from "@/lib/events";
import { senderFromProfile } from "@/lib/sender";
import type { Prospect } from "@/lib/types";

export type ActionResult = { ok: boolean; message: string };
const uuid = z.string().uuid();

function explain(e: unknown): string {
  if (e instanceof MissingEnvError) return `Server setup: ${e.message.split(".")[0]}.`;
  if (e instanceof AiError) return e.message;
  console.error("[prospects]", e instanceof Error ? e.message : "unknown error");
  return "Something went wrong. Please try again.";
}

/** Edit a message's subject/body. RLS only allows this while the message is a draft or scheduled. */
export async function saveMessage(messageId: string, subject: string, body: string): Promise<ActionResult> {
  if (!uuid.safeParse(messageId).success) return { ok: false, message: "Unknown message." };
  const s = subject.trim();
  const b = body.replace(/\r\n/g, "\n").trim();
  if (!s || s.length > 150) return { ok: false, message: "The subject must be 1–150 characters." };
  if (!b) return { ok: false, message: "The email can't be empty." };
  if (!isWithinWordLimit(b)) return { ok: false, message: `Too long: ${wordCount(b)} words. Emails must be under ${MAX_BODY_WORDS} words.` };
  if (/<\/?[a-z][^>]*>/i.test(b)) return { ok: false, message: "Plain text only: remove HTML tags." };

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("messages").update({ subject: s, body: b }).eq("id", messageId).select("id, prospect_id");
  if (error) return { ok: false, message: "Could not save the email." };
  if (!data?.length) return { ok: false, message: "This email has already been sent and can't be edited." };
  await logEvent(user.id, "message.edited", { message_id: messageId });
  revalidatePath(`/dashboard/prospects/${data[0].prospect_id}`);
  return { ok: true, message: "Saved." };
}

/** Re-run research (optional) and rewrite all three emails, while they are all still drafts. */
export async function rewriteEmails(prospectId: string, redoResearch: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(prospectId).success) return { ok: false, message: "Unknown prospect." };
  const { supabase } = await requireUser();
  const profile = await requireProfile();
  const { data: p } = await supabase.from("prospects").select("*").eq("id", prospectId).maybeSingle<Prospect>();
  if (!p) return { ok: false, message: "Unknown prospect." };
  if (!["new", "ready", "excluded"].includes(p.status)) return { ok: false, message: "This prospect's sequence has already started." };

  try {
    let prospect = p;
    if (redoResearch || !p.researched_at) {
      const r = await researchProspect(p);
      prospect = { ...p, research_notes: r.notes, personal_detail: r.detail, research_source_url: r.sourceUrl };
    }
    const w = await writeForProspect(senderFromProfile(profile), prospect, { replaceDrafts: true });
    revalidatePath(`/dashboard/prospects/${prospectId}`);
    if (!w.ok) return { ok: false, message: `Couldn't write emails that pass the checks: ${w.reason}` };
    return { ok: true, message: w.generic ? "Rewritten (generic: research was thin or unverifiable)." : "Rewritten with research." };
  } catch (e) {
    return { ok: false, message: explain(e) };
  }
}
