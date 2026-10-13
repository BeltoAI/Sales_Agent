import type { ParsedMail } from "mailparser";
import type { IncomingMail } from "./parse";

/** Convert a parsed MIME message into the fields the reply/bounce logic needs. */
export function toIncoming(p: ParsedMail): IncomingMail {
  const refs = p.references ? (Array.isArray(p.references) ? p.references : [p.references]) : [];
  const auto = p.headers.get("auto-submitted");
  return {
    messageId: p.messageId ?? null,
    inReplyTo: typeof p.inReplyTo === "string" ? p.inReplyTo : null,
    references: refs,
    from: p.from?.value?.[0]?.address ?? null,
    subject: p.subject ?? null,
    text: p.text ?? "",
    contentType: (() => {
      const ct = p.headers.get("content-type") as { value?: string; params?: Record<string, string> } | string | undefined;
      if (!ct) return null;
      if (typeof ct === "string") return ct;
      return `${ct.value ?? ""}; ${Object.entries(ct.params ?? {}).map(([k, v]) => `${k}=${v}`).join("; ")}`;
    })(),
    attachmentTexts: (p.attachments ?? [])
      .filter((a) => /message\/(rfc822|delivery-status)|text\/rfc822-headers|message\/global/i.test(a.contentType))
      .map((a) => a.content.toString("utf8").slice(0, 20_000)),
    autoSubmitted: typeof auto === "string" ? auto : null,
  };
}
