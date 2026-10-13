/**
 * Pure safety rules for outgoing email. No I/O, so they are easy to unit-test and are used by
 * both the writer (to reject drafts) and the sender (as the last check before every send).
 */

/** Emails must be UNDER this many words (body only, footer excluded). */
export const MAX_BODY_WORDS = 120;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isWithinWordLimit(body: string): boolean {
  return wordCount(body) < MAX_BODY_WORDS;
}

/** Shared/role mailboxes. Cold email to these is never personal and hurts deliverability. */
export const ROLE_LOCAL_PARTS = new Set([
  "abuse", "accounting", "accounts", "admin", "administrator", "all", "billing", "bookings", "careers",
  "ceo", "compliance", "contact", "contactus", "customercare", "customerservice", "dev", "devnull",
  "enquiries", "enquiry", "everyone", "feedback", "finance", "help", "helpdesk", "hello", "hi", "hostmaster",
  "hr", "info", "information", "inquiries", "inquiry", "invoice", "invoices", "it", "jobs", "legal",
  "mail", "mailer-daemon", "marketing", "media", "news", "newsletter", "no-reply", "noreply", "do-not-reply",
  "donotreply", "office", "operations", "orders", "partners", "payments", "postmaster", "press", "privacy",
  "recruiting", "recruitment", "reception", "root", "sales", "security", "service", "services", "shop",
  "spam", "staff", "support", "team", "tech", "test", "webmaster", "welcome",
]);

/** Lowercase, trimmed address. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string): string {
  return normalizeEmail(email).split("@")[1] ?? "";
}

/** True for info@, support@, sales@ ... (case-insensitive, ignores "+tag" and dots/dashes variants). */
export function isRoleAddress(email: string): boolean {
  const local = normalizeEmail(email).split("@")[0]?.split("+")[0] ?? "";
  if (!local) return true;
  return ROLE_LOCAL_PARTS.has(local) || ROLE_LOCAL_PARTS.has(local.replace(/[._]/g, "-")) || ROLE_LOCAL_PARTS.has(local.replace(/[._-]/g, ""));
}

/** Basic RFC-ish syntax check (deliberately conservative). */
export function isValidEmailSyntax(email: string): boolean {
  const e = normalizeEmail(email);
  if (e.length > 254) return false;
  const m = e.match(/^([a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*)@((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})$/);
  return Boolean(m && m[1].length <= 64);
}

/** Demo-provider addresses use reserved domains that can never reach a real person. */
export function isReservedDemoAddress(email: string): boolean {
  return /@example\.(com|org|net)$/.test(normalizeEmail(email));
}

export type SuppressionEntry = { email: string | null; domain: string | null };

/** True if the address or its domain (or a parent domain) is on the do-not-contact list. */
export function isSuppressed(email: string, list: SuppressionEntry[]): boolean {
  const e = normalizeEmail(email);
  const domain = emailDomain(e);
  return list.some((s) => {
    if (s.email && normalizeEmail(s.email) === e) return true;
    if (s.domain) {
      const d = s.domain.toLowerCase();
      return domain === d || domain.endsWith(`.${d}`);
    }
    return false;
  });
}
