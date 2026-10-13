import { describe, expect, it } from "vitest";
import { buildSearchPlan, icpFromForm, isExcluded, normalizeIcp, type Icp } from "./icp";

const base: Icp = {
  summary: " Ops leaders ",
  industries: ["logistics", "logistics", " "],
  titles: ["Head of Operations"],
  seniorities: ["director", "director"],
  company_size: { min: 500, max: 50 },
  locations: ["United States"],
  keywords: ["fleet"],
  exclusions: { companies: ["rival.com"], titles: ["intern"], keywords: ["broker"] },
};

describe("ICP", () => {
  it("normalizes: trims, dedupes, swaps inverted size range", () => {
    const n = normalizeIcp(base);
    expect(n.summary).toBe("Ops leaders");
    expect(n.industries).toEqual(["logistics"]);
    expect(n.seniorities).toEqual(["director"]);
    expect(n.company_size).toEqual({ min: 50, max: 500 });
  });

  it("builds employee ranges that overlap the size range", () => {
    const plan = buildSearchPlan(normalizeIcp(base));
    expect(plan.employee_ranges).toEqual(["21,50", "51,100", "101,200", "201,500"]);
    expect(plan.keywords).toEqual(["logistics", "fleet"]);
  });

  it("no size range → no employee filter", () => {
    expect(buildSearchPlan({ ...base, company_size: { min: null, max: null } }).employee_ranges).toEqual([]);
  });

  it("parses the edit form and drops unknown seniorities", () => {
    const f = new FormData();
    f.set("titles", "CEO, COO\nCFO");
    f.set("seniorities", "c_suite, wizard");
    f.set("size_min", "10");
    f.set("size_max", "");
    const icp = icpFromForm(f);
    expect(icp.titles).toEqual(["CEO", "COO", "CFO"]);
    expect(icp.seniorities).toEqual(["c_suite"]);
    expect(icp.company_size).toEqual({ min: 10, max: null });
  });

  it("applies exclusions to companies, domains, titles and keywords", () => {
    const ex = base.exclusions;
    expect(isExcluded(ex, { domain: "rival.com" })).toBe(true);
    expect(isExcluded(ex, { domain: "eu.rival.com" })).toBe(true);
    expect(isExcluded(ex, { domain: "notrival.com" })).toBe(false);
    expect(isExcluded(ex, { title: "Operations Intern" })).toBe(true);
    expect(isExcluded(ex, { industry: "freight broker" })).toBe(true);
    expect(isExcluded(ex, { company: "Acme", title: "COO", industry: "logistics" })).toBe(false);
  });
});
