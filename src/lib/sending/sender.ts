import "server-only";

import { randomUUID } from "node:crypto";
import type { Transporter } from "nodemailer";
import { emailDomain, normalizeEmail } from "@/lib/email/rules";
import { logEvent } from "@/lib/events";
import { createSmtpTransport } from "@/lib/mail/connection";
import { loadMailboxConnection } from "@/lib/mail/mailbox-store";
import { assertPublicHost } from "@/lib/net/public-host";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Mailbox, Message, Profile, Prospect } from "@/lib/types";
import { composeEmail, makeMessageId } from "./compose";
import { bouncePauseReason, classifySmtpError, decideSend, shouldPauseForBounces, type SendContext } from "./rules";
import { followUpSlot, safeTimezone, startOfLocalDay } from "./schedule";
import { cancelPendingMessages, setProspectStatus, suppressEmail } from "./stop";
import { unsubscribeUrl } from "./unsubscribe-token";

const BATCH = 20;
const STALE_CLAIM_MINUTES = 15;
const MAX_ATTEMPTS = 3;

export type SendRunResult = { claimed: number; sent: number; deferred: number; cancelled: number; failed: number; bounced: number };

type Db = ReturnType<typeof createAdminClient>;

/** Sends attempted from a mailbox since the start of the user's local day (sent + immediate bounces). */
async function attemptsToday(db: Db, userId: string, mailboxId: string, tz: string, now: Date) {
  const since = startOfLocalDay(now, tz).toISOString();
  const [sent, rejected, bounced] = await Promise.all([
    db.from("messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("mailbox_id", mailboxId).gte("sent_at", since),
    db.from("messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("mailbox_id", mailboxId).is("sent_at", null).gte("bounced_at", since),
    db.from("messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("mailbox_id", mailboxId).gte("bounced_at", since),
  ]);
  return { attempted: (sent.count ?? 0) + (rejected.count ?? 0), bounced: bounced.count ?? 0 };
}

/** Re-check today's bounce rate for a mailbox and pause it above 5%. Returns true if paused. */
export async function enforceBounceLimit(userId: string, mailboxId: string, tz: string, now = new Date()): Promise<boolean> {
  const db = createAdminClient();
  const { attempted, bounced } = await attemptsToday(db, userId, mailboxId, tz, now);
  if (!shouldPauseForBounces(bounced, attempted)) return false;
  const reason = bouncePauseReason(bounced, attempted);
  const { data } = await db
    .from("mailboxes")
    .update({ status: "paused", status_reason: reason })
    .eq("id", mailboxId)
    .eq("user_id", userId)
    .eq("status", "active")
    .select("id");
  if (data?.length) await logEvent(userId, "mailbox.auto_paused", { mailbox_id: mailboxId, bounced, attempted });
  return true;
}

async function isSuppressed(db: Db, userId: string, email: string): Promise<boolean> {
  const e = normalizeEmail(email);
  const domain = emailDomain(e);
  const labels = domain.split(".");
  const parents = labels.slice(0, -1).map((_, i) => labels.slice(i).join(".")); // a.b.com → a.b.com, b.com
  const [byEmail, byDomain] = await Promise.all([
    db.from("suppression").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("email", e),
    db.from("suppression").select("id", { count: "exact", head: true }).eq("user_id", userId).in("domain", parents.length ? parents : [domain]),
  ]);
  if (byEmail.error || byDomain.error) throw new Error("Could not check the do-not-contact list."); // fail closed
  return (byEmail.count ?? 0) > 0 || (byDomain.count ?? 0) > 0;
}

/**
 * One run of the send job. Idempotent and overlap-safe:
 *  - each message is claimed with a conditional update (scheduled → sending); only one run wins
 *  - every rule is re-checked with fresh data right before each send
 *  - a claim whose outcome is unknown (crash mid-send) is never retried, so nothing is sent twice
 */
export async function runSendJob({ budgetMs = 45_000 }: { budgetMs?: number } = {}): Promise<SendRunResult> {
  const started = Date.now();
  const db = createAdminClient();
  const result: SendRunResult = { claimed: 0, sent: 0, deferred: 0, cancelled: 0, failed: 0, bounced: 0 };
  const sendingDisabled = /^(1|true|yes)$/i.test(process.env.SENDING_DISABLED?.trim() ?? "");

  // 1. Claims older than 15 minutes: outcome unknown → fail, never resend.
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MINUTES * 60_000).toISOString();
  await db
    .from("messages")
    .update({ status: "failed", error: "Send outcome unknown (the job was interrupted). Not retried, to avoid sending twice." })
    .eq("status", "sending")
    .lt("claimed_at", staleBefore);

  // 2. Due messages.
  const { data: due } = await db
    .from("messages")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(BATCH);

  const transports = new Map<string, { transport: Transporter; from: string } | null>();
  const profiles = new Map<string, Profile | null>();

  try {
    for (const row of (due ?? []) as Message[]) {
      if (Date.now() - started > budgetMs) break;

      // 3. Claim.
      const { data: claimed } = await db
        .from("messages")
        .update({ status: "sending", claimed_at: new Date().toISOString(), attempts: row.attempts + 1 })
        .eq("id", row.id)
        .eq("status", "scheduled")
        .select("*");
      const msg = (claimed?.[0] ?? null) as Message | null;
      if (!msg) continue;
      result.claimed++;

      // Set once the SMTP server accepted the email: from then on it must NEVER be rescheduled.
      let delivered: { at: Date; messageId: string; mailboxId: string } | null = null;

      const finish = async (patch: Record<string, unknown>) => {
        await db.from("messages").update(patch).eq("id", msg.id).eq("status", "sending");
      };

      try {
        // 4. Fresh context.
        if (!profiles.has(msg.user_id)) {
          const { data } = await db.from("profiles").select("*").eq("user_id", msg.user_id).maybeSingle<Profile>();
          profiles.set(msg.user_id, data ?? null);
        }
        const profile = profiles.get(msg.user_id);
        const [{ data: prospect }, { data: campaign }, { data: steps }, { data: replies }] = await Promise.all([
          db.from("prospects").select("*").eq("id", msg.prospect_id).eq("user_id", msg.user_id).single<Prospect>(),
          db.from("campaigns").select("id, status, mailbox_id").eq("id", msg.campaign_id).eq("user_id", msg.user_id).single(),
          db.from("messages").select("id, step, status, sent_at, subject, message_id").eq("prospect_id", msg.prospect_id).eq("user_id", msg.user_id).order("step"),
          db.from("replies").select("id, category").eq("prospect_id", msg.prospect_id).eq("user_id", msg.user_id),
        ]);
        if (!profile || !prospect || !campaign) {
          await finish({ status: "cancelled", error: "Profile, prospect or campaign no longer exists." });
          result.cancelled++;
          continue;
        }

        const mailboxId = campaign.mailbox_id as string | null;
        const { data: mailbox } = mailboxId
          ? await db.from("mailboxes").select("id, email, status, daily_cap").eq("id", mailboxId).eq("user_id", msg.user_id).maybeSingle<Pick<Mailbox, "id" | "email" | "status" | "daily_cap">>()
          : { data: null };
        const userTz = safeTimezone(profile.timezone);
        const recipientTz = safeTimezone(prospect.timezone, userTz);
        const now = new Date();
        const previous = msg.step > 1 ? (steps ?? []).find((s) => s.step === msg.step - 1) ?? null : null;
        const today = mailbox ? await attemptsToday(db, msg.user_id, mailbox.id, userTz, now) : { attempted: 0, bounced: 0 };

        const ctx: SendContext = {
          now,
          sendingDisabled,
          unsubscribeBaseOk: Boolean(prospect.email && unsubscribeUrl(msg.user_id, prospect.email)),
          profile: { sending_paused: profile.sending_paused, mailing_address: profile.mailing_address, timezone: userTz },
          campaign: { status: campaign.status },
          mailbox: mailbox ? { status: mailbox.status, daily_cap: mailbox.daily_cap } : null,
          sentTodayFromMailbox: today.attempted,
          prospect: {
            status: prospect.status,
            is_demo: prospect.is_demo,
            email: prospect.email,
            email_status: prospect.email_status,
            resume_at: prospect.resume_at,
          },
          recipientTz,
          hasReply: (replies ?? []).some((r) => r.category !== "out_of_office"),
          suppressed: prospect.email ? await isSuppressed(db, msg.user_id, prospect.email) : false,
          message: { step: msg.step, subject: msg.subject, body: msg.body },
          previous: previous ? { status: previous.status, sent_at: previous.sent_at } : null,
        };

        // 5. Decide.
        const decision = decideSend(ctx);
        if (decision.action === "defer") {
          await finish({ status: "scheduled", scheduled_at: decision.until.toISOString(), error: decision.reason, attempts: msg.attempts - 1 });
          result.deferred++;
          continue;
        }
        if (decision.action === "cancel") {
          await finish({ status: "cancelled", error: decision.reason });
          await cancelPendingMessages(msg.user_id, msg.prospect_id, decision.reason);
          if (decision.prospectStatus) await setProspectStatus(msg.user_id, msg.prospect_id, decision.prospectStatus);
          await logEvent(msg.user_id, "send.cancelled", { message_id: msg.id, reason: decision.reason });
          result.cancelled++;
          continue;
        }
        if (decision.action === "fail") {
          await finish({ status: "failed", error: decision.reason });
          await logEvent(msg.user_id, "send.failed", { message_id: msg.id, reason: decision.reason });
          result.failed++;
          continue;
        }

        // 6. Send.
        if (!transports.has(mailbox!.id)) {
          const loaded = await loadMailboxConnection(msg.user_id, mailbox!.id);
          if (loaded) await assertPublicHost(loaded.connection.smtpHost);
          transports.set(mailbox!.id, loaded ? { transport: createSmtpTransport(loaded.connection), from: loaded.connection.email } : null);
        }
        const smtp = transports.get(mailbox!.id);
        if (!smtp) {
          await finish({ status: "scheduled", scheduled_at: new Date(Date.now() + 3_600_000).toISOString(), error: "Mailbox could not be loaded." });
          result.deferred++;
          continue;
        }

        const firstStep = (steps ?? []).find((s) => s.step === 1);
        const priorIds = (steps ?? []).filter((s) => s.step < msg.step && s.message_id).map((s) => s.message_id as string);
        const messageId = makeMessageId(randomUUID(), smtp.from);
        const email = composeEmail({
          step: msg.step,
          subject: msg.subject,
          body: msg.body,
          firstSubject: firstStep?.subject ?? null,
          senderName: profile.sender_name,
          companyName: profile.company_name,
          mailingAddress: profile.mailing_address,
          unsubscribeUrl: unsubscribeUrl(msg.user_id, prospect.email!)!,
          messageId,
          previousMessageIds: priorIds,
        });

        try {
          await smtp.transport.sendMail({
            from: { name: profile.sender_name, address: smtp.from },
            to: prospect.email!,
            subject: email.subject,
            text: email.text,
            messageId: email.messageId,
            inReplyTo: email.inReplyTo,
            references: email.references,
            headers: email.headers,
          });
        } catch (sendError) {
          const kind = classifySmtpError(sendError as Parameters<typeof classifySmtpError>[0]);
          const short = `${(sendError as { responseCode?: number }).responseCode ?? ""} ${String((sendError as Error).message ?? "").slice(0, 160)}`.trim();
          if (kind === "bounce") {
            const at = new Date().toISOString();
            await finish({ status: "failed", bounced_at: at, mailbox_id: mailbox!.id, error: `Bounced: ${short}` });
            await suppressEmail(msg.user_id, prospect.email!, "bounce");
            await cancelPendingMessages(msg.user_id, msg.prospect_id, "Address bounced.");
            await setProspectStatus(msg.user_id, msg.prospect_id, "bounced");
            await logEvent(msg.user_id, "send.bounced", { message_id: msg.id, mailbox_id: mailbox!.id });
            result.bounced++;
            await enforceBounceLimit(msg.user_id, mailbox!.id, userTz);
          } else if (kind === "mailbox") {
            await finish({ status: "scheduled", scheduled_at: new Date(Date.now() + 3_600_000).toISOString(), error: `Mailbox problem: ${short}`, attempts: msg.attempts - 1 });
            await db.from("mailboxes").update({ status: "error", status_reason: "Sending failed; check the mailbox.", last_error: short }).eq("id", mailbox!.id).eq("user_id", msg.user_id);
            await logEvent(msg.user_id, "mailbox.error", { mailbox_id: mailbox!.id });
            transports.set(mailbox!.id, null);
            result.deferred++;
          } else if (msg.attempts >= MAX_ATTEMPTS) {
            await finish({ status: "failed", error: `Gave up after ${msg.attempts} attempts: ${short}` });
            result.failed++;
          } else {
            await finish({ status: "scheduled", scheduled_at: new Date(Date.now() + 30 * 60_000).toISOString(), error: `Temporary error, will retry: ${short}` });
            result.deferred++;
          }
          continue;
        }

        // 7. Record success and schedule the next step.
        const sentAt = new Date();
        delivered = { at: sentAt, messageId, mailboxId: mailbox!.id };
        await finish({ status: "sent", sent_at: sentAt.toISOString(), message_id: messageId, mailbox_id: mailbox!.id, error: null });
        result.sent++;
        await logEvent(msg.user_id, "message.sent", { message_id: msg.id, prospect_id: msg.prospect_id, step: msg.step });

        if (msg.step < 3) {
          await db
            .from("messages")
            .update({ status: "scheduled", scheduled_at: followUpSlot(sentAt, sentAt, recipientTz).toISOString(), mailbox_id: mailbox!.id, error: null })
            .eq("prospect_id", msg.prospect_id)
            .eq("user_id", msg.user_id)
            .eq("step", msg.step + 1)
            .eq("status", "draft");
        } else {
          await db.from("prospects").update({ status: "completed" }).eq("id", msg.prospect_id).eq("user_id", msg.user_id).eq("status", "active");
        }
      } catch (e) {
        const reason = e instanceof Error ? e.message.slice(0, 200) : "error";
        if (delivered) {
          // Already sent: record it as sent (best effort); never reschedule.
          await finish({ status: "sent", sent_at: delivered.at.toISOString(), message_id: delivered.messageId, mailbox_id: delivered.mailboxId, error: null }).catch(() => {});
          await logEvent(msg.user_id, "send.post_send_error", { message_id: msg.id, error: reason });
          continue;
        }
        // Unexpected error before the SMTP call: put the message back for a later run.
        await finish({ status: msg.attempts >= MAX_ATTEMPTS ? "failed" : "scheduled", scheduled_at: new Date(Date.now() + 30 * 60_000).toISOString(), error: reason });
        await logEvent(msg.user_id, "send.error", { message_id: msg.id, error: reason });
        result.failed++;
      }
    }
  } finally {
    for (const t of transports.values()) t?.transport.close();
  }
  return result;
}
