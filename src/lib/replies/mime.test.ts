import { simpleParser } from "mailparser";
import { describe, expect, it } from "vitest";
import { toIncoming } from "./mime";
import { bouncedMessageIds, bouncedRecipients, isBounce, referencedIds } from "./parse";

const DSN = [
  "From: Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
  "To: ann@acme.com",
  "Subject: Delivery Status Notification (Failure)",
  "Message-ID: <dsn-1@mx.google.com>",
  "MIME-Version: 1.0",
  'Content-Type: multipart/report; boundary="b1"; report-type=delivery-status',
  "",
  "--b1",
  "Content-Type: text/plain",
  "",
  "Address not found. Your message wasn't delivered to ghost@corp.com.",
  "--b1",
  "Content-Type: message/delivery-status",
  "",
  "Reporting-MTA: dns; googlemail.com",
  "",
  "Final-Recipient: rfc822; ghost@corp.com",
  "Action: failed",
  "Status: 5.1.1",
  "--b1",
  "Content-Type: text/rfc822-headers",
  "",
  "From: Ann <ann@acme.com>",
  "To: ghost@corp.com",
  "Subject: quick question",
  "Message-ID: <step1-abc@acme.com>",
  "--b1--",
  "",
].join("\r\n");

const REPLY = [
  "From: Sam Lee <Sam@Corp.com>",
  "To: ann@acme.com",
  "Subject: Re: quick question",
  "Message-ID: <reply-9@corp.com>",
  "In-Reply-To: <step2-def@acme.com>",
  "References: <step1-abc@acme.com> <step2-def@acme.com>",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Happy to chat next week.",
  "",
  "On Tue, Oct 13, 2026 at 10:00 AM Ann <ann@acme.com> wrote:",
  "> Hi Sam",
  "",
].join("\r\n");

describe("MIME → IncomingMail", () => {
  it("recognises a real-format Gmail bounce and finds what bounced", async () => {
    const m = toIncoming(await simpleParser(DSN));
    expect(isBounce(m)).toBe(true);
    expect(bouncedRecipients(m)).toContain("ghost@corp.com");
    expect(bouncedMessageIds(m)).toContain("<step1-abc@acme.com>");
  });
  it("parses a reply's thread headers and sender", async () => {
    const m = toIncoming(await simpleParser(REPLY));
    expect(isBounce(m)).toBe(false);
    expect(m.from?.toLowerCase()).toBe("sam@corp.com");
    expect(m.messageId).toBe("<reply-9@corp.com>");
    expect(referencedIds(m)).toEqual(["<step2-def@acme.com>", "<step1-abc@acme.com>"]);
  });
});
