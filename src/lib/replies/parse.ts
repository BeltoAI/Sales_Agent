/**
 * Pure helpers for incoming mail: recognise bounces, pull out referenced Message-IDs, and strip
 * quoted history from replies. No I/O, unit-tested.
 */

export type IncomingMail = {
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  from: string | null;
  subject: string | null;
  text: string;
  contentType: string | null;
  /** Raw text of attached parts (e.g. the returned headers inside a bounce report). */
  attachmentTexts: string[];
  autoSubmitted: string | null;
};

const MSGID_RE = /<[^<>\s@]+@[^<>\s]+>/g;

export function extractMessageIds(text: string): string[] {
  return Array.from(new Set(text.match(MSGID_RE) ?? []));
}

/** Message-IDs this email says it is replying to (In-Reply-To first, then References newest first). */
export function referencedIds(mail: Pick<IncomingMail, "inReplyTo" | "references">): string[] {
  const ids = [...(mail.inReplyTo ? extractMessageIds(mail.inReplyTo) : []), ...[...mail.references].reverse().flatMap(extractMessageIds)];
  return Array.from(new Set(ids));
}

/** Delivery-failure reports (bounces). Delayed-delivery warnings are NOT bounces. */
export function isBounce(mail: IncomingMail): boolean {
  const from = (mail.from ?? "").toLowerCase();
  const subject = (mail.subject ?? "").toLowerCase();
  const ct = (mail.contentType ?? "").toLowerCase();
  const all = `${mail.text}\n${mail.attachmentTexts.join("\n")}`;
  const fromDaemon = /^(mailer-daemon|postmaster|mail-daemon)@/.test(from);
  const isReport = ct.includes("multipart/report") && ct.includes("delivery-status");
  const subjectLooks = /undeliver|delivery status notification \(failure\)|delivery (has )?failed|mail delivery (failed|subsystem)|returned mail|failure notice|could not be delivered/.test(subject);
  if (!fromDaemon && !isReport && !subjectLooks) return false;
  if (/action:\s*delayed/i.test(all) && !/action:\s*failed/i.test(all)) return false;
  return isReport || fromDaemon ? !/delivery status notification \(delay\)|delayed/i.test(subject) : true;
}

/** Recipients reported as failed in a bounce (Final-Recipient: rfc822; x@y). */
export function bouncedRecipients(mail: IncomingMail): string[] {
  const all = `${mail.text}\n${mail.attachmentTexts.join("\n")}`;
  const out = new Set<string>();
  for (const m of all.matchAll(/(?:final|original)-recipient:\s*rfc822;\s*<?([^\s<>;]+@[^\s<>;]+)>?/gi)) out.add(m[1].toLowerCase());
  return [...out];
}

/** Message-IDs quoted inside a bounce (the original email's headers are usually attached). */
export function bouncedMessageIds(mail: IncomingMail): string[] {
  const ids: string[] = [];
  for (const block of [mail.text, ...mail.attachmentTexts]) {
    for (const m of block.matchAll(/^message-id:\s*(<[^>\s]+>)/gim)) ids.push(m[1]);
  }
  return Array.from(new Set(ids));
}

/** Keep only what the person wrote: drop quoted history and signatures-separators. */
export function extractReplyText(text: string, maxChars = 2000): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const l = line.trim();
    if (/^on .{0,200}wrote:$/i.test(l) || /^-{2,}\s*original message\s*-{2,}$/i.test(l) || /^from:\s.+/i.test(l) && out.length > 0) break;
    if (/^>/.test(l)) continue;
    if (/^_{5,}$/.test(l)) break; // Outlook separator
    out.push(line);
  }
  const cleaned = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return (cleaned || text.trim()).slice(0, maxChars);
}
