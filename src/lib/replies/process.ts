import "server-only";

import { classifyReply, draftInterestedReply } from "@/lib/ai";
import { normalizeEmail } from "@/lib/email/rules";
import { logEvent } from "@/lib/events";
import { senderFromProfile } from "@/lib/sender";
import { enforceBounceLimit } from "@/lib/sending/sender";
import { followUpSlot, nextBusinessSlot, outOfOfficeResumeAt, safeTimezone } from "@/lib/sending/schedule";
import { cancelPendingMessages, holdPendingMessages, setProspectStatus, suppressEmail, unsubscribe } from "@/lib/sending/stop";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Prospect, Reply } from "@/lib/types";
import { bouncedMessageIds, bouncedRecipients, extractReplyText, isBounce, referencedIds, type IncomingMail } from "./parse";

type Db = ReturnType<typeof createAdminClient>;
export type IncomingOutcome = "reply" | "bounce" | "duplicate" | "ignored";

/**
 * Handle one incoming email for a user's mailbox. Idempotent: replies are stored once per
 * Message-ID, bounces only mark a message once.
 */
export async function handleIncoming(userId: string, mailboxId: string, mail: IncomingMail, receivedAt: Date): Promise<IncomingOutcome> {
  const db = createAdminClient();
  if (isBounce(mail)) return (await handleBounce(db, userId, mail)) ? "bounce" : "ignored";

  // Match the reply to something we sent: by thread headers first, then by sender address.
  const ids = referencedIds(mail);
  let sent: { id: string; prospect_id: string } | null = null;
  if (ids.length) {
    const { data } = await db.from("messages").select("id, prospect_id").eq("user_id", userId).in("message_id", ids).limit(1);
    sent = data?.[0] ?? null;
  }
  if (!sent && mail.from) {
    const { data: prospects } = await db
      .from("prospects")
      .select("id")
      .eq("user_id", userId)
      .eq("email", normalizeEmail(mail.from))
      .in("status", ["active", "paused", "completed", "replied"]);
    for (const p of prospects ?? []) {
      const { data } = await db.from("messages").select("id, prospect_id").eq("user_id", userId).eq("prospect_id", p.id).eq("status", "sent").order("step", { ascending: false }).limit(1);
      if (data?.[0]) {
        sent = data[0];
        break;
      }
    }
  }
  if (!sent) return "ignored";

  const emailMessageId = mail.messageId ?? `<no-id-${receivedAt.getTime()}-${normalizeEmail(mail.from ?? "unknown")}>`;
  const { data: inserted, error } = await db
    .from("replies")
    .insert({
      user_id: userId,
      prospect_id: sent.prospect_id,
      message_id: sent.id,
      mailbox_id: mailboxId,
      email_message_id: emailMessageId,
      from_email: mail.from ? normalizeEmail(mail.from) : null,
      subject: mail.subject?.slice(0, 300) ?? null,
      received_at: receivedAt.toISOString(),
      snippet: extractReplyText(mail.text),
    })
    .select("*")
    .single<Reply>();
  if (error) {
    if (error.code === "23505") return "duplicate";
    throw new Error(`Could not save reply (${error.code ?? "db error"}).`);
  }

  // Stop the sequence immediately, before classification (which can fail or be slow).
  await holdPendingMessages(userId, sent.prospect_id);
  await db.from("prospects").update({ status: "replied" }).eq("id", sent.prospect_id).eq("user_id", userId).in("status", ["active", "paused", "ready", "completed"]);
  await logEvent(userId, "reply.received", { reply_id: inserted.id, prospect_id: sent.prospect_id });

  await classifyAndApply(inserted);
  return "reply";
}

async function handleBounce(db: Db, userId: string, mail: IncomingMail): Promise<boolean> {
  const ids = bouncedMessageIds(mail);
  const recipients = bouncedRecipients(mail);
  let query = db.from("messages").select("id, prospect_id, mailbox_id, bounced_at, prospects!inner(email)").eq("user_id", userId).eq("status", "sent");
  if (ids.length) query = query.in("message_id", ids);
  else if (recipients.length) query = query.in("prospects.email", recipients);
  else return false;
  const { data } = await query.order("sent_at", { ascending: false }).limit(1);
  const msg = data?.[0] as unknown as { id: string; prospect_id: string; mailbox_id: string | null; bounced_at: string | null; prospects: { email: string } } | undefined;
  if (!msg || msg.bounced_at) return false;

  await db.from("messages").update({ bounced_at: new Date().toISOString() }).eq("id", msg.id).is("bounced_at", null);
  await suppressEmail(userId, msg.prospects.email, "bounce");
  await cancelPendingMessages(userId, msg.prospect_id, "Address bounced.");
  await setProspectStatus(userId, msg.prospect_id, "bounced");
  await logEvent(userId, "send.bounced", { message_id: msg.id, via: "bounce report" });
  if (msg.mailbox_id) {
    const { data: profile } = await db.from("profiles").select("timezone").eq("user_id", userId).single<Pick<Profile, "timezone">>();
    await enforceBounceLimit(userId, msg.mailbox_id, safeTimezone(profile?.timezone));
  }
  return true;
}

/** Classify a stored reply with Claude and apply the consequences. Safe to retry. */
export async function classifyAndApply(reply: Reply): Promise<void> {
  const db = createAdminClient();
  const [{ data: prospect }, { data: profile }] = await Promise.all([
    db.from("prospects").select("*").eq("id", reply.prospect_id).eq("user_id", reply.user_id).single<Prospect>(),
    db.from("profiles").select("*").eq("user_id", reply.user_id).single<Profile>(),
  ]);
  if (!prospect || !profile) return;

  let c;
  try {
    c = await classifyReply({ subject: reply.subject, text: reply.snippet ?? "", receivedAt: reply.received_at });
  } catch (e) {
    // Sequence is already stopped; classification is retried on the next run.
    await logEvent(reply.user_id, "reply.classify_failed", { reply_id: reply.id, error: e instanceof Error ? e.message.slice(0, 120) : "error" });
    return;
  }

  await db
    .from("replies")
    .update({ category: c.category, ooo_return_date: c.ooo_return_date, classified_at: new Date().toISOString() })
    .eq("id", reply.id)
    .eq("user_id", reply.user_id);
  await logEvent(reply.user_id, "reply.classified", { reply_id: reply.id, category: c.category });

  const email = prospect.email;
  switch (c.category) {
    case "unsubscribe":
      if (email) await unsubscribe(reply.user_id, email, "reply");
      await db.from("replies").update({ handled: true }).eq("id", reply.id);
      break;
    case "not_interested":
      if (email) await suppressEmail(reply.user_id, email, "not_interested");
      await cancelPendingMessages(reply.user_id, prospect.id, "Not interested.");
      await db.from("replies").update({ handled: true }).eq("id", reply.id);
      break;
    case "not_now":
      await cancelPendingMessages(reply.user_id, prospect.id, "Replied: not now.");
      break;
    case "interested": {
      await cancelPendingMessages(reply.user_id, prospect.id, "Replied: interested.");
      try {
        const draft = await draftInterestedReply({
          sender: senderFromProfile(profile),
          prospectFirstName: prospect.first_name,
          replyText: reply.snippet ?? "",
          calendlyUrl: profile.calendly_url,
        });
        await db.from("replies").update({ draft_reply: draft }).eq("id", reply.id);
      } catch {
        // The inbox still shows the reply; the user can write the answer themselves.
      }
      break;
    }
    case "out_of_office": {
      // Any earlier real reply means the sequence stays stopped for good.
      const { data: others } = await db.from("replies").select("category").eq("prospect_id", prospect.id).eq("user_id", reply.user_id).neq("id", reply.id);
      const realReply = (others ?? []).some((r) => r.category !== "out_of_office");
      if (realReply || ["unsubscribed", "bounced"].includes(prospect.status)) break;
      const tz = safeTimezone(prospect.timezone, safeTimezone(profile.timezone));
      const resumeAt = outOfOfficeResumeAt(c.ooo_return_date, new Date(reply.received_at), tz);
      await setProspectStatus(reply.user_id, prospect.id, "paused", { resume_at: resumeAt.toISOString() });
      await db.from("replies").update({ handled: true }).eq("id", reply.id);
      await logEvent(reply.user_id, "sequence.paused_ooo", { prospect_id: prospect.id, resume_at: resumeAt.toISOString() });
      break;
    }
  }
}

/** Retry classification for replies that failed to classify earlier. */
export async function classifyPending(limit = 10, budgetMs = 15_000): Promise<number> {
  const started = Date.now();
  const { data } = await createAdminClient().from("replies").select("*").is("category", null).order("received_at").limit(limit);
  let n = 0;
  for (const r of (data ?? []) as Reply[]) {
    if (Date.now() - started > budgetMs) break;
    await classifyAndApply(r);
    n++;
  }
  return n;
}

/**
 * Resume out-of-office pauses whose time has come: schedule the next unsent step (respecting the
 * 3-business-day spacing and business hours) and mark the prospect active again.
 */
export async function resumeOutOfOffice(limit = 50): Promise<number> {
  const db = createAdminClient();
  const now = new Date();
  const { data } = await db.from("prospects").select("*").eq("status", "paused").lte("resume_at", now.toISOString()).limit(limit);
  let resumed = 0;
  for (const p of (data ?? []) as Prospect[]) {
    const [{ data: replies }, { data: steps }, { data: profile }] = await Promise.all([
      db.from("replies").select("category").eq("prospect_id", p.id).eq("user_id", p.user_id),
      db.from("messages").select("id, step, status, sent_at").eq("prospect_id", p.id).eq("user_id", p.user_id).order("step"),
      db.from("profiles").select("timezone").eq("user_id", p.user_id).single<Pick<Profile, "timezone">>(),
    ]);
    // A real reply (or one still unclassified) ends the sequence instead.
    if ((replies ?? []).some((r) => r.category !== "out_of_office")) {
      await setProspectStatus(p.user_id, p.id, "replied", { resume_at: null });
      continue;
    }
    const next = (steps ?? []).find((s) => s.status === "draft");
    if (!next) {
      await setProspectStatus(p.user_id, p.id, "completed", { resume_at: null });
      continue;
    }
    const tz = safeTimezone(p.timezone, safeTimezone(profile?.timezone));
    const prev = (steps ?? []).find((s) => s.step === next.step - 1);
    const at = prev?.sent_at ? followUpSlot(new Date(prev.sent_at), now, tz) : nextBusinessSlot(now, tz);
    const { error } = await db.from("prospects").update({ status: "active", resume_at: null }).eq("id", p.id).eq("user_id", p.user_id).eq("status", "paused");
    if (error) continue; // e.g. now active in another campaign
    await db.from("messages").update({ status: "scheduled", scheduled_at: at.toISOString(), error: null }).eq("id", next.id).eq("status", "draft");
    await logEvent(p.user_id, "sequence.resumed", { prospect_id: p.id, step: next.step });
    resumed++;
  }
  return resumed;
}
