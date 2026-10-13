import "server-only";

import { resolveMx } from "node:dns/promises";
import { emailDomain, isReservedDemoAddress, isValidEmailSyntax } from "@/lib/email/rules";
import type { EmailStatus } from "@/lib/types";

/**
 * Email verification behind a provider interface. Only "valid" addresses may ever be sent to.
 * Today there is one implementation: syntax + MX ("basic"), used because no paid provider is configured.
 * A paid provider (ZeroBounce, NeverBounce, ...) can be added as another EmailVerifier and selected by env key.
 */

export type VerifyStatus = Exclude<EmailStatus, "unchecked">;
export type VerifyResult = { status: VerifyStatus; provider: string; reason: string };

export interface EmailVerifier {
  id: string;
  verify(email: string): Promise<VerifyResult>;
}

type MxLookup = (domain: string) => Promise<{ exchange: string; priority: number }[]>;

/** Syntax + MX check. Per the owner's decision, a pass counts as "valid". */
export function basicVerifier(lookupMx: MxLookup = resolveMx): EmailVerifier {
  return {
    id: "basic",
    async verify(email) {
      const r = (status: VerifyStatus, reason: string): VerifyResult => ({ status, provider: "basic", reason });
      if (!isValidEmailSyntax(email)) return r("invalid", "bad syntax");
      if (isReservedDemoAddress(email)) return r("invalid", "reserved demo domain");
      const domain = emailDomain(email);
      try {
        const mx = await lookupMx(domain);
        // RFC 7505 "null MX" (a single "." record) means the domain accepts no mail.
        const usable = mx.filter((m) => m.exchange && m.exchange !== ".");
        if (usable.length === 0) return r("invalid", "domain accepts no email");
        return r("valid", "syntax ok, domain has MX records");
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === "ENOTFOUND" || code === "ENODATA") return r("invalid", "domain has no mail server");
        return r("unknown", `DNS lookup failed (${code ?? "error"})`);
      }
    },
  };
}

/** The active verifier. Add paid providers here, selected by their env key. */
export function getVerifier(): EmailVerifier {
  return basicVerifier();
}
