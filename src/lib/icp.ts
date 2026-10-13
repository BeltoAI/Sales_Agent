import { z } from "zod";

/** Seniority levels (these match Apollo's filter values). */
export const SENIORITIES = ["owner", "founder", "c_suite", "partner", "vp", "head", "director", "manager", "senior", "entry"] as const;

/** Target customer profile: what Claude produces from the description and the user edits/approves. */
export const icpSchema = z.object({
  summary: z.string().describe("One or two sentences describing the ideal customer."),
  industries: z.array(z.string()).describe("Target industries, e.g. 'logistics', 'dental clinics'."),
  titles: z.array(z.string()).describe("Job titles of the people to contact, e.g. 'Head of Operations'."),
  seniorities: z.array(z.enum(SENIORITIES)).describe("Seniority levels of the people to contact."),
  company_size: z.object({
    min: z.number().int().nullable().describe("Minimum employees, or null for no minimum."),
    max: z.number().int().nullable().describe("Maximum employees, or null for no maximum."),
  }),
  locations: z.array(z.string()).describe("Countries, states or cities, e.g. 'United States', 'Berlin, Germany'."),
  keywords: z.array(z.string()).describe("Keywords describing target companies, e.g. 'fleet management'."),
  exclusions: z.object({
    companies: z.array(z.string()).describe("Company names or domains never to contact (competitors, existing customers)."),
    titles: z.array(z.string()).describe("Title words to exclude, e.g. 'intern', 'recruiter'."),
    keywords: z.array(z.string()).describe("Company keywords/industries to exclude."),
  }),
});

export type Icp = z.infer<typeof icpSchema>;

/** Stricter checks applied after the model / user edits (structured outputs can't express all of these). */
export function normalizeIcp(icp: Icp): Icp {
  const clean = (list: string[], max = 25) =>
    Array.from(new Set(list.map((s) => s.trim()).filter(Boolean).map((s) => s.slice(0, 100)))).slice(0, max);
  let { min, max } = icp.company_size;
  min = min !== null && min > 0 ? Math.min(min, 1_000_000) : null;
  max = max !== null && max > 0 ? Math.min(max, 1_000_000) : null;
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  return {
    summary: icp.summary.trim().slice(0, 600),
    industries: clean(icp.industries),
    titles: clean(icp.titles),
    seniorities: Array.from(new Set(icp.seniorities)),
    company_size: { min, max },
    locations: clean(icp.locations),
    keywords: clean(icp.keywords),
    exclusions: {
      companies: clean(icp.exclusions.companies, 200),
      titles: clean(icp.exclusions.titles),
      keywords: clean(icp.exclusions.keywords),
    },
  };
}

/** Provider-neutral search plan derived from an approved ICP. Stored in campaigns.search_plan_json. */
export type SearchPlan = {
  titles: string[];
  seniorities: string[];
  locations: string[];
  keywords: string[];
  employee_ranges: string[]; // "min,max" strings
  exclusions: Icp["exclusions"];
};

/** Standard headcount buckets; the plan uses every bucket that overlaps the ICP's size range. */
const SIZE_BUCKETS: Array<[number, number]> = [
  [1, 10],
  [11, 20],
  [21, 50],
  [51, 100],
  [101, 200],
  [201, 500],
  [501, 1000],
  [1001, 2000],
  [2001, 5000],
  [5001, 10000],
  [10001, 1_000_000],
];

export function buildSearchPlan(icp: Icp): SearchPlan {
  const { min, max } = icp.company_size;
  const lo = min ?? 1;
  const hi = max ?? 1_000_000;
  const employee_ranges =
    min === null && max === null ? [] : SIZE_BUCKETS.filter(([a, b]) => b >= lo && a <= hi).map(([a, b]) => `${a},${b}`);
  return {
    titles: icp.titles,
    seniorities: icp.seniorities,
    locations: icp.locations,
    // Industries are searched as company keywords (provider industry IDs vary).
    keywords: Array.from(new Set([...icp.industries, ...icp.keywords])),
    employee_ranges,
    exclusions: icp.exclusions,
  };
}

/** Parse the "edit ICP" form: comma or newline separated lists. */
export function icpFromForm(form: FormData): Icp {
  const list = (name: string) =>
    String(form.get(name) ?? "")
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  const num = (name: string) => {
    const v = String(form.get(name) ?? "").trim();
    return v === "" || Number.isNaN(Number(v)) ? null : Math.round(Number(v));
  };
  const seniorities = list("seniorities").filter((s): s is (typeof SENIORITIES)[number] =>
    (SENIORITIES as readonly string[]).includes(s),
  );
  return normalizeIcp({
    summary: String(form.get("summary") ?? ""),
    industries: list("industries"),
    titles: list("titles"),
    seniorities,
    company_size: { min: num("size_min"), max: num("size_max") },
    locations: list("locations"),
    keywords: list("keywords"),
    exclusions: {
      companies: list("exclude_companies"),
      titles: list("exclude_titles"),
      keywords: list("exclude_keywords"),
    },
  });
}

/** True if a found company/person should be skipped because of the ICP's exclusions. */
export function isExcluded(
  exclusions: Icp["exclusions"],
  lead: { company?: string | null; domain?: string | null; title?: string | null; industry?: string | null },
): boolean {
  const lc = (s?: string | null) => (s ?? "").toLowerCase();
  const company = lc(lead.company);
  const domain = lc(lead.domain);
  const title = lc(lead.title);
  const industry = lc(lead.industry);
  return (
    exclusions.companies.some((c) => {
      const x = c.toLowerCase();
      return (company && company === x) || (domain && (domain === x || domain.endsWith(`.${x}`)));
    }) ||
    exclusions.titles.some((t) => title.includes(t.toLowerCase())) ||
    exclusions.keywords.some((k) => industry.includes(k.toLowerCase()) || company.includes(k.toLowerCase()))
  );
}
