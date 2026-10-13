import type { SearchPlan } from "@/lib/icp";

/** A person found by a lead provider, normalised to our prospect fields. */
export type Lead = {
  source: "apollo" | "demo";
  /** The provider's id for this person (de-duplication across searches). */
  source_ref: string;
  name: string;
  first_name: string | null;
  title: string | null;
  company: string | null;
  domain: string | null;
  industry: string | null;
  linkedin_url: string | null;
  location: string | null;
  timezone: string | null;
  email: string | null;
  is_demo: boolean;
};

export type LeadPage = { leads: Lead[]; hasMore: boolean };

export interface LeadProvider {
  id: "apollo" | "demo";
  label: string;
  /** Demo providers return fake people that can never be emailed. */
  isDemo: boolean;
  search(plan: SearchPlan, opts: { page: number; perPage: number }): Promise<LeadPage>;
}

export class LeadProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadProviderError";
  }
}
