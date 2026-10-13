import { describe, expect, it } from "vitest";
import { isRoleAddress, isSuppressed } from "@/lib/email/rules";
import { bouncePauseReason, classifySmtpError, decideSend, shouldPauseForBounces, type SendContext } from "./rules";
import { addBusinessDays, isBusinessHours, zonedTimeToUtc } from "./schedule";

const NY = "America/New_York";
const TUE_11AM = zonedTimeToUtc(2026, 10, 13, 11, 0, NY);

/** A context in which sending is allowed; each test breaks exactly one rule. */
function ctx(over: Partial<SendContext> = {}, prospect: Partial<SendContext["prospect"]> = {}): SendContext {
  return {
    now: TUE_11AM,
    sendingDisabled: false,
    unsubscribeBaseOk: true,
    profile: { sending_paused: false, mailing_address: "1 Main St, Springfield", timezone: NY },
    campaign: { status: "running" },
    mailbox: { status: "active", daily_cap: 30 },
    sentTodayFromMailbox: 0,
    prospect: { status: "active", is_demo: false, email: "sam@acme.com", email_status: "valid", resume_at: null, ...prospect },
    recipientTz: NY,
    hasReply: false,
    suppressed: false,
    message: { step: 1, subject: "quick question", body: "Hi Sam, short note." },
    previous: null,
    ...over,
  };
}

const action = (c: SendContext) => decideSend(c).action;

describe("decideSend: the last gate before every email", () => {
  it("sends when every rule passes", () => expect(action(ctx())).toBe("send"));

  it("only sends to addresses verified 'valid'", () => {
    for (const s of ["unchecked", "invalid", "risky", "unknown"] as const) {
      expect(decideSend(ctx({}, { email_status: s }))).toMatchObject({ action: "cancel", prospectStatus: "excluded" });
    }
  });

  it("never sends to role addresses", () => {
    for (const e of ["info@acme.com", "Support@acme.com", "sales+eu@acme.com", "no-reply@acme.com", "noreply@acme.com"]) {
      expect(action(ctx({}, { email: e }))).toBe("cancel");
    }
  });

  it("never sends to suppressed contacts (checked before every send)", () => {
    expect(decideSend(ctx({ suppressed: true }))).toMatchObject({ action: "cancel", prospectStatus: "excluded" });
  });

  it("never sends to demo prospects, even if everything else looks valid", () => {
    expect(action(ctx({}, { is_demo: true }))).toBe("cancel");
    expect(action(ctx({}, { email: "alex.lee+x@example.com" }))).toBe("cancel");
  });

  it("stops the whole sequence on any reply", () => {
    expect(decideSend(ctx({ hasReply: true }))).toMatchObject({ action: "cancel", prospectStatus: "replied" });
  });

  it("does not send to prospects that replied, unsubscribed, bounced or completed", () => {
    for (const s of ["replied", "unsubscribed", "bounced", "completed", "excluded", "new", "ready"] as const) {
      expect(action(ctx({}, { status: s }))).toBe("cancel");
    }
  });

  it("defers out-of-office prospects until they return, inside business hours", () => {
    const back = zonedTimeToUtc(2026, 10, 20, 0, 0, NY).toISOString();
    const d = decideSend(ctx({}, { status: "paused", resume_at: back }));
    expect(d.action).toBe("defer");
    if (d.action === "defer") {
      expect(d.until.getTime()).toBeGreaterThanOrEqual(new Date(back).getTime());
      expect(isBusinessHours(d.until, NY)).toBe(true);
    }
  });

  it("the global pause switch blocks sending", () => {
    expect(decideSend(ctx({ profile: { sending_paused: true, mailing_address: "x", timezone: NY } }))).toMatchObject({ action: "defer" });
  });

  it("the server kill switch (SENDING_DISABLED) blocks sending", () => {
    expect(action(ctx({ sendingDisabled: true }))).toBe("defer");
  });

  it("requires a mailing address for the footer", () => {
    expect(action(ctx({ profile: { sending_paused: false, mailing_address: "  ", timezone: NY } }))).toBe("defer");
  });

  it("requires a working unsubscribe link base URL", () => {
    expect(action(ctx({ unsubscribeBaseOk: false }))).toBe("defer");
  });

  it("does not send from paused/errored mailboxes or without a mailbox", () => {
    expect(action(ctx({ mailbox: { status: "paused", daily_cap: 30 } }))).toBe("defer");
    expect(action(ctx({ mailbox: { status: "error", daily_cap: 30 } }))).toBe("defer");
    expect(action(ctx({ mailbox: null }))).toBe("defer");
  });

  it("does not send when the campaign isn't running", () => {
    expect(action(ctx({ campaign: { status: "paused" } }))).toBe("defer");
    expect(action(ctx({ campaign: { status: "draft" } }))).toBe("defer");
    expect(action(ctx({ campaign: { status: "done" } }))).toBe("cancel");
  });

  describe("daily cap per mailbox", () => {
    it("stops at the mailbox cap", () => {
      expect(action(ctx({ sentTodayFromMailbox: 29 }))).toBe("send");
      expect(action(ctx({ sentTodayFromMailbox: 30 }))).toBe("defer");
      expect(action(ctx({ mailbox: { status: "active", daily_cap: 10 }, sentTodayFromMailbox: 10 }))).toBe("defer");
    });
    it("never exceeds 50 even if a larger cap is stored", () => {
      expect(action(ctx({ mailbox: { status: "active", daily_cap: 500 }, sentTodayFromMailbox: 50 }))).toBe("defer");
      expect(action(ctx({ mailbox: { status: "active", daily_cap: 500 }, sentTodayFromMailbox: 49 }))).toBe("send");
    });
    it("defers to a later business day inside business hours", () => {
      const d = decideSend(ctx({ sentTodayFromMailbox: 30 }));
      expect(d.action).toBe("defer");
      if (d.action === "defer") {
        expect(isBusinessHours(d.until, NY)).toBe(true);
        expect(d.until.getTime()).toBeGreaterThan(TUE_11AM.getTime() + 6 * 3_600_000);
      }
    });
  });

  describe("business hours in the recipient's timezone", () => {
    it("defers outside hours to the next business slot", () => {
      const sat = zonedTimeToUtc(2026, 10, 17, 11, 0, NY);
      const d = decideSend(ctx({ now: sat }));
      expect(d.action).toBe("defer");
      if (d.action === "defer") expect(isBusinessHours(d.until, NY)).toBe(true);
    });
    it("uses the recipient's timezone", () => {
      // 11:00 in New York is 17:00 in Berlin.
      expect(action(ctx({ recipientTz: "Europe/Berlin" }))).toBe("defer");
    });
  });

  describe("minimum 3 business days between steps", () => {
    const sentFri = zonedTimeToUtc(2026, 10, 9, 10, 0, NY);
    it("defers a follow-up that comes too early", () => {
      const d = decideSend(ctx({ message: { step: 2, subject: "s", body: "b" }, previous: { status: "sent", sent_at: sentFri.toISOString() } }));
      expect(d.action).toBe("defer"); // Tue 13th 11:00 is only 2 business days after Fri 9th
      if (d.action === "defer") expect(d.until.getTime()).toBeGreaterThanOrEqual(addBusinessDays(sentFri, 3, NY).getTime());
    });
    it("allows it after 3 business days", () => {
      const wed = zonedTimeToUtc(2026, 10, 14, 11, 0, NY);
      expect(action(ctx({ now: wed, message: { step: 2, subject: "s", body: "b" }, previous: { status: "sent", sent_at: sentFri.toISOString() } }))).toBe("send");
    });
    it("never sends step 2 if step 1 wasn't sent", () => {
      expect(action(ctx({ message: { step: 2, subject: "s", body: "b" }, previous: { status: "cancelled", sent_at: null } }))).toBe("cancel");
      expect(action(ctx({ message: { step: 2, subject: "s", body: "b" }, previous: null }))).toBe("cancel");
    });
  });

  it("refuses emails of 120 words or more", () => {
    const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");
    expect(action(ctx({ message: { step: 1, subject: "s", body: words(119) } }))).toBe("send");
    expect(action(ctx({ message: { step: 1, subject: "s", body: words(120) } }))).toBe("fail");
    expect(action(ctx({ message: { step: 1, subject: " ", body: "hi" } }))).toBe("fail");
  });
});

describe("bounce auto-pause (> 5% in a day)", () => {
  it("pauses strictly above 5%", () => {
    expect(shouldPauseForBounces(0, 30)).toBe(false);
    expect(shouldPauseForBounces(1, 20)).toBe(false); // exactly 5%
    expect(shouldPauseForBounces(1, 19)).toBe(true);
    expect(shouldPauseForBounces(2, 30)).toBe(true);
    expect(shouldPauseForBounces(0, 0)).toBe(false);
  });
  it("explains why", () => expect(bouncePauseReason(2, 25)).toMatch(/2 of 25 .*8%/));
});

describe("SMTP error classification", () => {
  it("recipient rejections are bounces", () => {
    expect(classifySmtpError({ responseCode: 550, message: "550 5.1.1 User unknown", command: "RCPT TO" })).toBe("bounce");
    expect(classifySmtpError({ responseCode: 550, message: "550 5.1.1 The email account that you tried to reach does not exist" })).toBe("bounce");
  });
  it("quota/auth/policy problems are mailbox problems, not bounces", () => {
    expect(classifySmtpError({ responseCode: 550, message: "550 5.4.5 Daily user sending limit exceeded" })).toBe("mailbox");
    expect(classifySmtpError({ code: "EAUTH", responseCode: 535, message: "Invalid login" })).toBe("mailbox");
    expect(classifySmtpError({ responseCode: 554, message: "554 5.7.1 Message rejected as spam" })).toBe("mailbox");
  });
  it("4xx and network errors are transient", () => {
    expect(classifySmtpError({ responseCode: 421, message: "421 try again later" })).toBe("transient");
    expect(classifySmtpError({ code: "ETIMEDOUT", message: "Connection timeout" })).toBe("transient");
  });
});

describe("role addresses and suppression matching", () => {
  it("detects role addresses case-insensitively, ignoring +tags", () => {
    expect(isRoleAddress("INFO@acme.com")).toBe(true);
    expect(isRoleAddress("hello+promo@acme.com")).toBe(true);
    expect(isRoleAddress("do_not_reply@acme.com")).toBe(true);
    expect(isRoleAddress("sam.lee@acme.com")).toBe(false);
  });
  it("matches suppressed emails and (sub)domains", () => {
    const list = [{ email: "x@acme.com", domain: null }, { email: null, domain: "corp.io" }];
    expect(isSuppressed("X@ACME.com", list)).toBe(true);
    expect(isSuppressed("a@eu.corp.io", list)).toBe(true);
    expect(isSuppressed("a@notcorp.io", list)).toBe(false);
  });
});
