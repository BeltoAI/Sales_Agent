import { describe, expect, it } from "vitest";
import { computeStats, percent } from "./stats";

describe("dashboard stats", () => {
  const prospects = [
    { id: "p1", campaign_id: "A" },
    { id: "p2", campaign_id: "A" },
    { id: "p3", campaign_id: "B" },
  ];
  const messages = [
    { campaign_id: "A", status: "sent", sent_at: "t", bounced_at: null },
    { campaign_id: "A", status: "sent", sent_at: "t", bounced_at: "t" }, // later bounce report
    { campaign_id: "A", status: "failed", sent_at: null, bounced_at: "t" }, // rejected immediately
    { campaign_id: "B", status: "scheduled", sent_at: null, bounced_at: null },
  ];
  const replies = [
    { prospect_id: "p1", category: "interested" },
    { prospect_id: "p1", category: "interested" }, // same person twice → 1
    { prospect_id: "p2", category: "out_of_office" }, // not a reply
    { prospect_id: "p3", category: null }, // unclassified still counts
  ];
  const { byCampaign, total } = computeStats(prospects, messages, replies);

  it("counts per campaign", () => {
    expect(byCampaign.get("A")).toEqual({ prospects: 2, sent: 2, replies: 1, interested: 1, bounces: 2, bounceRate: 2 / 3 });
    expect(byCampaign.get("B")).toMatchObject({ prospects: 1, sent: 0, replies: 1, bounces: 0, bounceRate: 0 });
  });
  it("totals", () => {
    expect(total).toEqual({ prospects: 3, sent: 2, replies: 2, interested: 1, bounces: 2, bounceRate: 2 / 3 });
  });
  it("formats percentages", () => {
    expect(percent(0)).toBe("0%");
    expect(percent(0.034)).toBe("3.4%");
    expect(percent(2 / 3)).toBe("67%");
  });
});
