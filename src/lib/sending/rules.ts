import { isReservedDemoAddress, isRoleAddress, isWithinWordLimit, wordCount, MAX_BODY_WORDS } from "@/lib/email/rules";
import type { CampaignStatus, EmailStatus, MailboxStatus, ProspectStatus } from "@/lib/types";
import { addBusinessDays, followUpSlot, isBusinessHours, MIN_BUSINESS_DAYS_BETWEEN_STEPS, nextBusinessSlot } from "./schedule";

/** Hard ceiling, regardless of what is stored (the DB also enforces it). */
export const ABSOLUTE_DAILY_CAP = 50;
/** Pause a mailbox when more than this share of today's sends bounced. */
export const BOUNCE_PAUSE_THRESHOLD = 0.05;

/** Everything the decision needs, loaded fresh right before each send. */
export type SendContext = {
  now: Date;
  sendingDisabled: boolean;
  unsubscribeBaseOk: boolean;
  profile: { sending_paused: boolean; mailing_address: string | null; timezone: string };
  campaign: { status: CampaignStatus } | null;
  mailbox: { status: MailboxStatus; daily_cap: number } | null;
  /** Sends attempted from this mailbox since the start of today (user's timezone). */
  sentTodayFromMailbox: number;
  prospect: {
    status: ProspectStatus;
    is_demo: boolean;
    email: string | null;
    email_status: EmailStatus;
    resume_at: string | null;
  };
  /** Recipient timezone (already resolved: prospect's, else the user's). */
  recipientTz: string;
  /**
   * The prospect sent a reply that stops the sequence for good: any reply that is NOT classified as
   * out-of-office (unclassified replies count, to fail safe). Out-of-office replies pause instead.
   */
  hasReply: boolean;
  suppressed: boolean;
  message: { step: number; subject: string; body: string };
  /** The previous step of the sequence (null for step 1). */
  previous: { status: string; sent_at: string | null } | null;
};

export type SendDecision =
  | { action: "send" }
  | { action: "defer"; until: Date; reason: string }
  | { action: "cancel"; reason: string; prospectStatus?: ProspectStatus }
  | { action: "fail"; reason: string };

const HOUR = 3_600_000;

/**
 * The last gate before every single email. Order matters:
 *  1. Reasons this email must never go out → cancel
 *  2. Content problems the user must fix → fail
 *  3. Temporary blocks (pauses, hours, caps, spacing) → defer
 */
export function decideSend(c: SendContext): SendDecision {
  const p = c.prospect;

  // 1. Never send.
  if (p.is_demo || (p.email && isReservedDemoAddress(p.email))) return { action: "cancel", reason: "Demo prospect: demo data is never emailed." };
  if (!p.email) return { action: "cancel", reason: "No email address.", prospectStatus: "excluded" };
  if (c.hasReply) return { action: "cancel", reason: "The prospect replied; sequence stopped.", prospectStatus: "replied" };
  if (p.status === "paused") {
    const until = p.resume_at ? new Date(p.resume_at) : new Date(c.now.getTime() + 24 * HOUR);
    return { action: "defer", until: nextBusinessSlot(new Date(Math.max(until.getTime(), c.now.getTime())), c.recipientTz), reason: "Out of office; waiting to resume." };
  }
  if (p.status !== "active") return { action: "cancel", reason: `Prospect is ${p.status}; sequence stopped.` };
  if (p.email_status !== "valid") return { action: "cancel", reason: `Email not verified as valid (${p.email_status}).`, prospectStatus: "excluded" };
  if (isRoleAddress(p.email)) return { action: "cancel", reason: "Role address (info@, support@, ...): never emailed.", prospectStatus: "excluded" };
  if (c.suppressed) return { action: "cancel", reason: "On the do-not-contact list.", prospectStatus: "excluded" };
  if (c.campaign?.status === "done") return { action: "cancel", reason: "Campaign finished." };
  if (c.message.step > 1 && c.previous?.status !== "sent") {
    if (c.previous?.status === "scheduled" || c.previous?.status === "sending") {
      return { action: "defer", until: new Date(c.now.getTime() + 24 * HOUR), reason: "Waiting for the previous step." };
    }
    return { action: "cancel", reason: "The previous step was not sent." };
  }

  // 2. Content.
  if (!c.message.subject.trim() || !c.message.body.trim()) return { action: "fail", reason: "Empty subject or body." };
  if (!isWithinWordLimit(c.message.body)) {
    return { action: "fail", reason: `Too long (${wordCount(c.message.body)} words; must be under ${MAX_BODY_WORDS}). Edit it, then it can be rescheduled.` };
  }

  // 3. Temporary blocks.
  const hourLater = new Date(c.now.getTime() + HOUR);
  if (c.sendingDisabled) return { action: "defer", until: hourLater, reason: "Sending is disabled on the server (SENDING_DISABLED)." };
  if (!c.unsubscribeBaseOk) return { action: "defer", until: hourLater, reason: "APP_URL is not set, so unsubscribe links would not work." };
  if (c.profile.sending_paused) return { action: "defer", until: hourLater, reason: "All sending is paused." };
  if (!c.profile.mailing_address?.trim()) return { action: "defer", until: hourLater, reason: "Add your mailing address in Settings." };
  if (c.campaign?.status !== "running") return { action: "defer", until: hourLater, reason: "Campaign is not running." };
  if (!c.mailbox) return { action: "defer", until: hourLater, reason: "No mailbox selected for this campaign." };
  if (c.mailbox.status !== "active") return { action: "defer", until: hourLater, reason: `Mailbox is ${c.mailbox.status}.` };

  if (c.message.step > 1 && c.previous?.sent_at) {
    const prevSent = new Date(c.previous.sent_at);
    if (c.now < addBusinessDays(prevSent, MIN_BUSINESS_DAYS_BETWEEN_STEPS, c.recipientTz)) {
      return { action: "defer", until: followUpSlot(prevSent, c.now, c.recipientTz), reason: "Less than 3 business days since the previous email." };
    }
  }
  if (!isBusinessHours(c.now, c.recipientTz)) {
    return { action: "defer", until: nextBusinessSlot(c.now, c.recipientTz), reason: "Outside the recipient's business hours." };
  }
  const cap = Math.min(Math.max(c.mailbox.daily_cap, 0), ABSOLUTE_DAILY_CAP);
  if (c.sentTodayFromMailbox >= cap) {
    // Try again on a later business day.
    return { action: "defer", until: nextBusinessSlot(new Date(c.now.getTime() + 12 * HOUR), c.recipientTz), reason: `Daily cap of ${cap} reached for this mailbox.` };
  }

  return { action: "send" };
}

/** True when more than 5% of today's attempted sends from a mailbox bounced. */
export function shouldPauseForBounces(bouncedToday: number, attemptedToday: number): boolean {
  return attemptedToday > 0 && bouncedToday / attemptedToday > BOUNCE_PAUSE_THRESHOLD;
}

export function bouncePauseReason(bouncedToday: number, attemptedToday: number): string {
  const pct = Math.round((bouncedToday / Math.max(attemptedToday, 1)) * 100);
  return `Paused automatically: ${bouncedToday} of ${attemptedToday} emails sent today bounced (${pct}%, limit 5%). Check your list, then resume.`;
}

export type SmtpFailure = "bounce" | "mailbox" | "transient";

/**
 * Classify an SMTP error:
 *  - bounce: the recipient address was rejected (5xx on RCPT / 5.1.x)
 *  - mailbox: our account/limits are the problem (auth, quota, policy) → stop using this mailbox
 *  - transient: anything else (4xx, network) → retry later
 */
export function classifySmtpError(err: { responseCode?: number; code?: string; message?: string; command?: string }): SmtpFailure {
  const msg = (err.message ?? "").toLowerCase();
  const code = err.responseCode ?? 0;
  if (err.code === "EAUTH" || code === 535 || code === 534 || code === 530) return "mailbox";
  if (/quota|rate limit|too many|sending limit|limit exceeded|daily user sending|suspended|blocked|spam|policy/.test(msg)) return "mailbox";
  if (code >= 500 && code < 600) {
    if (err.command === "RCPT TO" || /5\.1\.\d|user unknown|no such user|does not exist|mailbox unavailable|recipient (address )?rejected|invalid recipient|address rejected/.test(msg)) {
      return "bounce";
    }
    return "mailbox";
  }
  return "transient";
}
