/** Dashboard numbers, computed from light row sets (pure, unit-tested). */

export type StatsProspect = { id: string; campaign_id: string };
export type StatsMessage = { campaign_id: string; status: string; sent_at: string | null; bounced_at: string | null };
export type StatsReply = { prospect_id: string; category: string | null };

export type CampaignStats = { prospects: number; sent: number; replies: number; interested: number; bounces: number; bounceRate: number };

const empty = (): CampaignStats => ({ prospects: 0, sent: 0, replies: 0, interested: 0, bounces: 0, bounceRate: 0 });

/**
 * Per-campaign and total stats.
 * - sent: emails accepted by the mail server
 * - bounces: emails that bounced (rejected immediately, or reported later)
 * - bounceRate: bounces / attempted sends (sent + immediate rejections)
 * - replies / interested: distinct prospects; out-of-office auto-replies don't count as replies
 */
export function computeStats(prospects: StatsProspect[], messages: StatsMessage[], replies: StatsReply[]) {
  const byCampaign = new Map<string, CampaignStats & { attempts: number }>();
  const get = (id: string) => {
    let s = byCampaign.get(id);
    if (!s) byCampaign.set(id, (s = { ...empty(), attempts: 0 }));
    return s;
  };
  const campaignOf = new Map(prospects.map((p) => [p.id, p.campaign_id]));
  for (const p of prospects) get(p.campaign_id).prospects++;

  for (const m of messages) {
    const s = get(m.campaign_id);
    const sent = m.status === "sent";
    const rejected = Boolean(m.bounced_at) && !m.sent_at;
    if (sent) s.sent++;
    if (m.bounced_at) s.bounces++;
    if (sent || rejected) s.attempts++;
  }

  const replied = new Map<string, Set<string>>();
  const interested = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, key: string, value: string) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(value);
  };
  for (const r of replies) {
    const c = campaignOf.get(r.prospect_id);
    if (!c || r.category === "out_of_office") continue;
    add(replied, c, r.prospect_id);
    if (r.category === "interested") add(interested, c, r.prospect_id);
  }

  const total = { ...empty(), attempts: 0 };
  const out = new Map<string, CampaignStats>();
  for (const [id, s] of byCampaign) {
    s.replies = replied.get(id)?.size ?? 0;
    s.interested = interested.get(id)?.size ?? 0;
    s.bounceRate = s.attempts ? s.bounces / s.attempts : 0;
    for (const k of ["prospects", "sent", "replies", "interested", "bounces", "attempts"] as const) total[k] += s[k];
    const { attempts: _attempts, ...publicStats } = s;
    void _attempts;
    out.set(id, publicStats);
  }
  total.bounceRate = total.attempts ? total.bounces / total.attempts : 0;
  const { attempts: _t, ...totalStats } = total;
  void _t;
  return { byCampaign: out, total: totalStats };
}

export function percent(ratio: number): string {
  if (!ratio) return "0%";
  const p = ratio * 100;
  return `${p < 10 ? p.toFixed(1) : Math.round(p)}%`;
}
