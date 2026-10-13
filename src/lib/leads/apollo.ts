import "server-only";

import type { SearchPlan } from "@/lib/icp";
import { LeadProviderError, type Lead, type LeadPage, type LeadProvider } from "./types";

/**
 * Apollo.io provider (used when APOLLO_API_KEY is set).
 * 1. People search (no credits, returns ids but no emails)
 * 2. Bulk match by id, 10 at a time (consumes Apollo credits, returns work emails)
 * NOTE: written from Apollo's API docs without a live key; see TODO.md.
 */

const BASE = "https://api.apollo.io/api/v1";
const TIMEOUT_MS = 20_000;

type ApolloPerson = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  title?: string | null;
  email?: string | null;
  email_status?: string | null;
  linkedin_url?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  time_zone?: string | null;
  organization?: {
    name?: string | null;
    primary_domain?: string | null;
    website_url?: string | null;
    industry?: string | null;
  } | null;
};

async function apollo<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "x-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new LeadProviderError("Could not reach Apollo. Try again.");
  }
  if (res.status === 401 || res.status === 403) {
    throw new LeadProviderError("Apollo rejected the API key. People search needs a master API key (Apollo → Settings → API Keys).");
  }
  if (res.status === 429) throw new LeadProviderError("Apollo rate limit reached. Try again later.");
  if (res.status === 422 || res.status === 400) throw new LeadProviderError("Apollo rejected the search filters. Try simplifying the profile.");
  if (!res.ok) throw new LeadProviderError(`Apollo returned an error (HTTP ${res.status}).`);
  return (await res.json()) as T;
}

function domainFrom(org: ApolloPerson["organization"]): string | null {
  const raw = org?.primary_domain || org?.website_url;
  if (!raw) return null;
  try {
    return new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function usableEmail(p: ApolloPerson): string | null {
  const email = p.email?.trim().toLowerCase();
  if (!email || !email.includes("@") || email.startsWith("email_not_unlocked")) return null;
  // Apollo marks guesses as "guessed"/"unavailable"; our own verifier still checks every address.
  return email;
}

export function apolloProvider(apiKey: string): LeadProvider {
  return {
    id: "apollo",
    label: "Apollo",
    isDemo: false,
    async search(plan: SearchPlan, { page, perPage }): Promise<LeadPage> {
      const search = await apollo<{ people?: ApolloPerson[]; total_entries?: number; pagination?: { total_pages?: number } }>(
        apiKey,
        "/mixed_people/api_search",
        {
          person_titles: plan.titles.length ? plan.titles : undefined,
          include_similar_titles: true,
          person_seniorities: plan.seniorities.length ? plan.seniorities : undefined,
          person_locations: plan.locations.length ? plan.locations : undefined,
          organization_num_employees_ranges: plan.employee_ranges.length ? plan.employee_ranges : undefined,
          q_keywords: plan.keywords.length ? plan.keywords.slice(0, 5).join(" ") : undefined,
          page,
          per_page: Math.min(perPage, 100),
        },
      );
      const ids = (search.people ?? []).map((p) => p.id).filter((id): id is string => Boolean(id));
      const totalPages = search.pagination?.total_pages ?? Math.ceil((search.total_entries ?? 0) / Math.max(perPage, 1));

      const leads: Lead[] = [];
      for (let i = 0; i < ids.length; i += 10) {
        const batch = ids.slice(i, i + 10);
        const match = await apollo<{ matches?: (ApolloPerson | null)[] }>(apiKey, "/people/bulk_match?reveal_personal_emails=false", {
          details: batch.map((id) => ({ id })),
        });
        for (const p of match.matches ?? []) {
          if (!p?.id) continue;
          const name = p.name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
          if (!name) continue;
          leads.push({
            source: "apollo",
            source_ref: p.id,
            name,
            first_name: p.first_name?.trim() || null,
            title: p.title?.trim() || null,
            company: p.organization?.name?.trim() || null,
            domain: domainFrom(p.organization),
            industry: p.organization?.industry ?? null,
            linkedin_url: p.linkedin_url ?? null,
            location: [p.city, p.state, p.country].filter(Boolean).join(", ") || null,
            timezone: p.time_zone ?? null,
            email: usableEmail(p),
            is_demo: false,
          });
        }
      }
      return { leads, hasMore: page < totalPages };
    },
  };
}
