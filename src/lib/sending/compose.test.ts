import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { composeEmail, makeMessageId } from "./compose";
import { createUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe-token";

const base = {
  step: 1,
  subject: "quick question",
  body: "Hi Sam,\r\n\r\nShort note.\n\nAnn",
  firstSubject: "quick question",
  senderName: "Ann Lee",
  companyName: "Acme",
  mailingAddress: "Acme Inc.\n1 Main St\nSpringfield, IL",
  unsubscribeUrl: "https://app.test/u/tok",
  messageId: "<abc@acme.com>",
  previousMessageIds: [],
};

describe("composeEmail", () => {
  it("adds a plain unsubscribe line with the one-click link and the physical address", () => {
    const e = composeEmail(base);
    expect(e.text).toContain("Unsubscribe with one click: https://app.test/u/tok");
    expect(e.text).toContain("Acme Inc., 1 Main St, Springfield, IL");
    expect(e.text.startsWith("Hi Sam,\n\nShort note.")).toBe(true);
  });
  it("adds RFC 8058 one-click unsubscribe headers", () => {
    expect(composeEmail(base).headers).toEqual({
      "List-Unsubscribe": "<https://app.test/u/tok>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });
  it("is plain text: no HTML, no tracking pixel, no rewritten links", () => {
    const e = composeEmail(base) as unknown as Record<string, unknown>;
    expect(e.html).toBeUndefined();
    expect(String(e.text)).not.toMatch(/<img|<a |https?:\/\/(?!app\.test\/u\/)/);
  });
  it("threads follow-ups as replies to the earlier steps", () => {
    const e = composeEmail({ ...base, step: 3, previousMessageIds: ["<1@acme.com>", "<2@acme.com>"] });
    expect(e.subject).toBe("Re: quick question");
    expect(e.inReplyTo).toBe("<2@acme.com>");
    expect(e.references).toEqual(["<1@acme.com>", "<2@acme.com>"]);
  });
  it("strips line breaks from the subject (header injection)", () => {
    expect(composeEmail({ ...base, subject: "hi\r\nBcc: evil@x.com" }).subject).toBe("hi Bcc: evil@x.com");
  });
  it("makes Message-IDs on the sender's domain", () => {
    expect(makeMessageId("123", "ann@Acme.com")).toBe("<123@acme.com>");
  });
});

describe("unsubscribe tokens", () => {
  const original = process.env.ENCRYPTION_KEY;
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
  });
  afterAll(() => {
    process.env.ENCRYPTION_KEY = original;
  });

  it("round-trips user and (normalised) email", () => {
    expect(verifyUnsubscribeToken(createUnsubscribeToken("user-1", "Sam@Acme.com"))).toEqual({ userId: "user-1", email: "sam@acme.com" });
  });
  it("rejects tampered tokens (can't unsubscribe someone else)", () => {
    const t = createUnsubscribeToken("user-1", "sam@acme.com");
    const [, sig] = t.split(".");
    const forged = `${Buffer.from(JSON.stringify({ u: "user-1", e: "boss@acme.com" })).toString("base64url")}.${sig}`;
    expect(verifyUnsubscribeToken(forged)).toBeNull();
    expect(verifyUnsubscribeToken(`${t}x`)).toBeNull();
    expect(verifyUnsubscribeToken("garbage")).toBeNull();
  });
  it("tokens stop working if the key changes", () => {
    const t = createUnsubscribeToken("user-1", "sam@acme.com");
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(verifyUnsubscribeToken(t)).toBeNull();
  });
});
