import { describe, expect, it } from "vitest";
import { bouncedMessageIds, bouncedRecipients, extractReplyText, isBounce, referencedIds, type IncomingMail } from "./parse";

const mail = (over: Partial<IncomingMail> = {}): IncomingMail => ({
  messageId: "<r1@corp.com>",
  inReplyTo: null,
  references: [],
  from: "sam@corp.com",
  subject: "Re: quick question",
  text: "Sounds good.",
  contentType: "text/plain",
  attachmentTexts: [],
  autoSubmitted: null,
  ...over,
});

describe("reply matching", () => {
  it("collects referenced Message-IDs, In-Reply-To first", () => {
    expect(referencedIds(mail({ inReplyTo: "<b@acme.com>", references: ["<a@acme.com> <b@acme.com>"] }))).toEqual(["<b@acme.com>", "<a@acme.com>"]);
  });
});

describe("bounce detection", () => {
  const dsn = mail({
    from: "mailer-daemon@googlemail.com",
    subject: "Delivery Status Notification (Failure)",
    contentType: 'multipart/report; report-type="delivery-status"',
    text: "Address not found",
    attachmentTexts: ["Final-Recipient: rfc822; ghost@corp.com\nAction: failed\nStatus: 5.1.1", "Message-ID: <abc@acme.com>\nSubject: quick question"],
  });
  it("recognises a delivery failure report", () => expect(isBounce(dsn)).toBe(true));
  it("finds the failed recipient and the original Message-ID", () => {
    expect(bouncedRecipients(dsn)).toEqual(["ghost@corp.com"]);
    expect(bouncedMessageIds(dsn)).toEqual(["<abc@acme.com>"]);
  });
  it("ignores delayed-delivery warnings", () => {
    expect(isBounce({ ...dsn, subject: "Delivery Status Notification (Delay)", attachmentTexts: ["Action: delayed"] })).toBe(false);
  });
  it("normal replies are not bounces", () => {
    expect(isBounce(mail())).toBe(false);
    expect(isBounce(mail({ subject: "Out of office", text: "I'm away until Monday" }))).toBe(false);
  });
});

describe("extractReplyText", () => {
  it("drops quoted history", () => {
    const t = "Yes, let's talk Tuesday.\n\nOn Mon, Oct 12, 2026 at 9:00 AM Ann <ann@acme.com> wrote:\n> Hi Sam,\n> quick question";
    expect(extractReplyText(t)).toBe("Yes, let's talk Tuesday.");
  });
  it("drops > quoted lines and Outlook separators", () => {
    expect(extractReplyText("No thanks.\n> old\n________________\nFrom: Ann")).toBe("No thanks.");
  });
  it("caps length", () => expect(extractReplyText("a".repeat(5000), 100)).toHaveLength(100));
});
