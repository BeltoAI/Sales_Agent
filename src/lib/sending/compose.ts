/**
 * Builds the exact plain-text email that goes out. No HTML part, no images, no tracking pixels,
 * no link rewriting. Every email gets an unsubscribe line with a one-click link and the sender's
 * physical mailing address (CAN-SPAM), plus RFC 8058 one-click List-Unsubscribe headers.
 */

export type ComposeInput = {
  step: number;
  subject: string;
  body: string;
  firstSubject: string | null;
  senderName: string;
  companyName: string;
  mailingAddress: string;
  unsubscribeUrl: string;
  messageId: string;
  /** Message-IDs of the earlier steps, oldest first (for threading follow-ups). */
  previousMessageIds: string[];
};

export type ComposedEmail = {
  subject: string;
  text: string;
  messageId: string;
  headers: Record<string, string>;
  inReplyTo?: string;
  references?: string[];
};

export function footer(i: Pick<ComposeInput, "senderName" | "companyName" | "mailingAddress" | "unsubscribeUrl">): string {
  const address = i.mailingAddress
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(", ");
  return [
    "--",
    `${i.senderName}, ${i.companyName}`,
    address,
    `Don't want these emails? Unsubscribe with one click: ${i.unsubscribeUrl}`,
  ].join("\n");
}

/** Strip characters that could break headers (CR/LF) from a single-line value. */
function oneLine(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim();
}

export function composeEmail(i: ComposeInput): ComposedEmail {
  let subject = oneLine(i.subject);
  const first = i.firstSubject ? oneLine(i.firstSubject) : null;
  // Follow-ups that reuse the first subject read as replies in the same thread.
  if (i.step > 1 && first && subject.toLowerCase() === first.toLowerCase() && !/^re:/i.test(subject)) subject = `Re: ${subject}`;

  const body = i.body.replace(/\r\n/g, "\n").trim();
  const text = `${body}\n\n${footer(i)}\n`;

  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${i.unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
  const prev = i.previousMessageIds.filter(Boolean);
  return {
    subject,
    text,
    messageId: i.messageId,
    headers,
    ...(i.step > 1 && prev.length ? { inReplyTo: prev[prev.length - 1], references: prev } : {}),
  };
}

/** A globally unique Message-ID on the sender's own domain. */
export function makeMessageId(uuid: string, fromEmail: string): string {
  const domain = fromEmail.split("@")[1]?.toLowerCase() || "localhost";
  return `<${uuid}@${domain}>`;
}
