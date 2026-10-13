import type { SearchPlan } from "@/lib/icp";
import type { Lead, LeadPage, LeadProvider } from "./types";

/**
 * DEMO provider: clearly labelled fake people, used when no APOLLO_API_KEY is set, so the whole
 * app can be tried for free. Every address is @example.com (a reserved domain that reaches nobody),
 * every row is flagged is_demo, and the sender refuses to send to demo prospects.
 */

const COMPANIES = [
  { name: "Northwind Logistics (demo)", slug: "northwind", industry: "logistics" },
  { name: "Bluebird Dental Group (demo)", slug: "bluebird-dental", industry: "healthcare" },
  { name: "Copperleaf Software (demo)", slug: "copperleaf", industry: "software" },
  { name: "Harbor & Pine Realty (demo)", slug: "harborpine", industry: "real estate" },
  { name: "Summit Fleet Services (demo)", slug: "summitfleet", industry: "transportation" },
  { name: "Lumen Clinics (demo)", slug: "lumenclinics", industry: "healthcare" },
  { name: "Riverstone Manufacturing (demo)", slug: "riverstone", industry: "manufacturing" },
  { name: "Orchard Analytics (demo)", slug: "orchard", industry: "software" },
  { name: "Granite Peak Construction (demo)", slug: "granitepeak", industry: "construction" },
  { name: "Tidewater Foods (demo)", slug: "tidewater", industry: "food & beverage" },
];

const FIRST = ["Alex", "Jordan", "Sam", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Avery", "Quinn", "Drew", "Robin"];
const LAST = ["Lee", "Patel", "Garcia", "Nguyen", "Kim", "Johnson", "Müller", "Rossi", "Silva", "Novak", "Brown", "Haddad"];

const LOCATIONS: Array<{ location: string; timezone: string }> = [
  { location: "Austin, Texas, United States", timezone: "America/Chicago" },
  { location: "Denver, Colorado, United States", timezone: "America/Denver" },
  { location: "Boston, Massachusetts, United States", timezone: "America/New_York" },
  { location: "Seattle, Washington, United States", timezone: "America/Los_Angeles" },
  { location: "London, United Kingdom", timezone: "Europe/London" },
  { location: "Berlin, Germany", timezone: "Europe/Berlin" },
];

const DEFAULT_TITLES = ["Head of Operations", "VP Sales", "Founder", "Operations Manager"];
const TOTAL = 60; // fake people available per search

/** Small deterministic PRNG so the same search returns the same people. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function slug(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
}

export function demoPerson(plan: SearchPlan, index: number): Lead {
  const r = rng(hash(`${plan.titles.join("|")}#${plan.locations.join("|")}#${index}`));
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)];
  const company = COMPANIES[index % COMPANIES.length];
  const first = pick(FIRST);
  const last = pick(LAST);
  const titles = plan.titles.length ? plan.titles : DEFAULT_TITLES;
  const place = pick(LOCATIONS);
  const location = plan.locations.length ? `${plan.locations[index % plan.locations.length]} (demo)` : place.location;
  // Every 15th person has a role address, to show that those are filtered out.
  const local = index % 15 === 14 ? "info" : `${slug(first)}.${slug(last)}.${index}`;
  return {
    source: "demo",
    source_ref: `demo-${index}`,
    name: `${first} ${last}`,
    first_name: first,
    title: titles[index % titles.length],
    company: company.name,
    domain: `${company.slug}.example`,
    industry: company.industry,
    linkedin_url: null,
    location,
    timezone: place.timezone,
    email: `${local}+${company.slug}@example.com`,
    is_demo: true,
  };
}

export const demoProvider: LeadProvider = {
  id: "demo",
  label: "Demo data",
  isDemo: true,
  async search(plan, { page, perPage }): Promise<LeadPage> {
    const start = (page - 1) * perPage;
    const end = Math.min(start + perPage, TOTAL);
    const leads: Lead[] = [];
    for (let i = start; i < end; i++) leads.push(demoPerson(plan, i));
    return { leads, hasMore: end < TOTAL };
  },
};

/** Canned, clearly fake research for demo companies (the researcher never fetches .example sites). */
export function demoResearch(company: string | null): { notes: string; detail: string; sourceUrl: string } {
  const c = COMPANIES.find((x) => x.name === company) ?? COMPANIES[0];
  return {
    notes:
      `- [DEMO] ${c.name} is a fictional ${c.industry} company used for testing.\n` +
      `- [DEMO] Its (fictional) website says it recently opened a second location.`,
    detail: "[DEMO] recently opened a second location",
    sourceUrl: `https://${c.slug}.example/about`,
  };
}
