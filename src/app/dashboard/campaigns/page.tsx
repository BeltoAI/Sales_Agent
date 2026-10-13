import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import type { Campaign } from "@/lib/types";
import { Card, LinkButton, Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/ui";
import { CampaignBadge } from "../badges";

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const { supabase } = await requireUser();
  const [{ data: campaigns }, { data: prospects }] = await Promise.all([
    supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
    supabase.from("prospects").select("campaign_id, status"),
  ]);

  const counts = new Map<string, { total: number; replied: number }>();
  for (const p of prospects ?? []) {
    const c = counts.get(p.campaign_id) ?? { total: 0, replied: 0 };
    c.total++;
    if (p.status === "replied") c.replied++;
    counts.set(p.campaign_id, c);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="mt-1 text-sm text-muted">Each campaign targets one kind of customer.</p>
        </div>
        <LinkButton href="/dashboard/campaigns/new">New campaign</LinkButton>
      </div>
      <Card>
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Status</TH>
              <TH>Prospects</TH>
              <TH>Replied</TH>
              <TH>Created</TH>
            </tr>
          </THead>
          <TBody>
            {(campaigns as Campaign[] | null)?.length ? (
              (campaigns as Campaign[]).map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/dashboard/campaigns/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                  </TD>
                  <TD>
                    <CampaignBadge status={c.status} />
                  </TD>
                  <TD className="tabular-nums">{counts.get(c.id)?.total ?? 0}</TD>
                  <TD className="tabular-nums">{counts.get(c.id)?.replied ?? 0}</TD>
                  <TD className="text-muted">{new Date(c.created_at).toLocaleDateString()}</TD>
                </TR>
              ))
            ) : (
              <TableEmpty colSpan={5}>No campaigns yet. Create one to start finding prospects.</TableEmpty>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
