import { describe, expect, it } from "vitest";
import { buildSearchPlan, normalizeIcp } from "@/lib/icp";
import { demoPerson, demoProvider } from "@/lib/leads/demo";
import type { Lead } from "@/lib/leads/types";
import { isReservedDemoAddress } from "@/lib/email/rules";
import { skipReason } from "./finder";

const plan = buildSearchPlan(
  normalizeIcp({
    summary: "",
    industries: [],
    titles: ["COO"],
    seniorities: [],
    company_size: { min: null, max: null },
    locations: [],
    keywords: [],
    exclusions: { companies: ["blocked.com"], titles: [], keywords: [] },
  }),
);

const lead = (over: Partial<Lead> = {}): Lead => ({
  source: "apollo",
  source_ref: "p1",
  name: "Sam Lee",
  first_name: "Sam",
  title: "COO",
  company: "Acme",
  domain: "acme.com",
  industry: null,
  linkedin_url: null,
  location: null,
  timezone: null,
  email: "sam@acme.com",
  is_demo: false,
  ...over,
});

const ctx = () => ({
  suppressed: [{ email: "gone@acme.com", domain: null }, { email: null, domain: "nope.io" }],
  seenEmails: new Set(["dup@acme.com"]),
  seenRefs: new Set(["seen-ref"]),
  busy: new Set(["busy@acme.com"]),
});

describe("finder filtering", () => {
  it("accepts a normal lead", () => expect(skipReason(lead(), plan, ctx())).toBeNull());
  it("skips leads without email", () => expect(skipReason(lead({ email: null }), plan, ctx())).toBe("no_email"));
  it("skips duplicates by email (case-insensitive) and by provider id", () => {
    expect(skipReason(lead({ email: "DUP@acme.com" }), plan, ctx())).toBe("duplicate");
    expect(skipReason(lead({ source_ref: "seen-ref" }), plan, ctx())).toBe("duplicate");
  });
  it("skips suppressed emails and domains", () => {
    expect(skipReason(lead({ email: "Gone@Acme.com" }), plan, ctx())).toBe("suppressed");
    expect(skipReason(lead({ email: "x@sub.nope.io" }), plan, ctx())).toBe("suppressed");
  });
  it("skips role addresses", () => expect(skipReason(lead({ email: "info@acme.com" }), plan, ctx())).toBe("role_address"));
  it("skips excluded companies", () => expect(skipReason(lead({ email: "a@blocked.com", domain: "blocked.com" }), plan, ctx())).toBe("excluded"));
  it("skips people active in another campaign", () => expect(skipReason(lead({ email: "busy@acme.com" }), plan, ctx())).toBe("active_elsewhere"));
});

describe("demo provider", () => {
  it("only produces flagged people at reserved example.com addresses", async () => {
    const { leads, hasMore } = await demoProvider.search(plan, { page: 1, perPage: 25 });
    expect(leads).toHaveLength(25);
    expect(hasMore).toBe(true);
    for (const l of leads) {
      expect(l.is_demo).toBe(true);
      expect(l.source).toBe("demo");
      expect(isReservedDemoAddress(l.email!)).toBe(true);
      expect(l.email).toBe(l.email!.toLowerCase());
    }
  });
  it("is deterministic and pages to the end", async () => {
    expect(demoPerson(plan, 3)).toEqual(demoPerson(plan, 3));
    const last = await demoProvider.search(plan, { page: 3, perPage: 25 });
    expect(last.hasMore).toBe(false);
    expect(last.leads).toHaveLength(10);
  });
});
