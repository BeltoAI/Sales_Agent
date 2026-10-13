import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { icpSchema, normalizeIcp, type Icp } from "@/lib/icp";
import type { Campaign, Prospect } from "@/lib/types";
import { Badge, Card, CardBody, CardHeader, Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/ui";
import { ActionButton } from "../../ActionButton";
import { CampaignBadge, DemoBadge, EmailStatusBadge, ProspectBadge } from "../../badges";
import { deleteCampaign, findMore, pauseCampaign, regenerateIcp, researchAndWrite, setCampaignMailbox, startCampaign } from "../actions";
import { IcpForm } from "./IcpForm";
import { MailboxPicker } from "./MailboxPicker";

export const metadata: Metadata = { title: "Campaign" };
// Planner + finder (and later the writer) can take a while.
export const maxDuration = 60;

function readIcp(value: unknown): Icp | null {
  const parsed = icpSchema.safeParse(value);
  return parsed.success ? normalizeIcp(parsed.data) : null;
}

export default async function CampaignPage({ params, searchParams }: PageProps<"/dashboard/campaigns/[id]">) {
  const { id } = await params;
  const { plan_failed } = await searchParams;
  const { supabase } = await requireUser();

  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle<Campaign>();
  if (!campaign) notFound();

  const [{ data: prospects }, { data: mailboxes }] = await Promise.all([
    supabase.from("prospects").select("*").eq("campaign_id", id).order("created_at", { ascending: true }).limit(500),
    supabase.from("mailboxes").select("id, email, status").order("created_at"),
  ]);
  const list = (prospects ?? []) as Prospect[];
  const icp = readIcp(campaign.icp_json);
  const approved = Boolean(campaign.icp_approved_at);
  const hasDemo = list.some((p) => p.is_demo);
  const newCount = list.filter((p) => p.status === "new").length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/dashboard/campaigns" className="text-sm text-muted hover:text-fg">
            ← Campaigns
          </Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {campaign.name} <CampaignBadge status={campaign.status} />
          </h1>
          <p className="mt-2 max-w-3xl text-sm whitespace-pre-line text-muted">{campaign.description}</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <MailboxPicker
            mailboxes={mailboxes ?? []}
            value={campaign.mailbox_id ?? ""}
            onChange={setCampaignMailbox.bind(null, campaign.id)}
          />
          {approved &&
            (campaign.status === "running" ? (
              <ActionButton action={pauseCampaign.bind(null, campaign.id)} variant="secondary">
                Pause campaign
              </ActionButton>
            ) : (
              <ActionButton action={startCampaign.bind(null, campaign.id)} variant="primary" pendingLabel="Starting…">
                {campaign.status === "paused" ? "Resume sending" : "Start sending"}
              </ActionButton>
            ))}
          <ActionButton
            action={deleteCampaign.bind(null, campaign.id)}
            variant="ghost"
            confirmText="Delete this campaign, its prospects and messages? This cannot be undone."
          >
            Delete campaign
          </ActionButton>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Target customer profile"
          description={
            approved
              ? `Approved ${new Date(campaign.icp_approved_at!).toLocaleString()}. Edit and save to search again.`
              : "Review and edit what the planner produced, then approve it to start finding prospects."
          }
          action={
            <ActionButton action={regenerateIcp.bind(null, campaign.id)} pendingLabel="Planning…">
              {icp ? "Regenerate with AI" : "Generate with AI"}
            </ActionButton>
          }
        />
        <CardBody className="py-6">
          {plan_failed && !icp && (
            <p className="mb-5 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              The planner couldn&apos;t create a profile. Click &quot;Generate with AI&quot; to retry and see why, or fill it in yourself.
            </p>
          )}
          <IcpForm key={campaign.updated_at} campaignId={campaign.id} icp={icp} approved={approved} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              Prospects <Badge>{list.length}</Badge> {hasDemo && <DemoBadge />}
            </span>
          }
          description={
            hasDemo
              ? "Demo prospects are fake (@example.com) and are never emailed. Add APOLLO_API_KEY to find real people."
              : "Found by the finder. Duplicates, suppressed contacts and role addresses are removed automatically."
          }
          action={
            approved ? (
              <div className="flex flex-wrap items-start gap-2">
                <ActionButton action={findMore.bind(null, campaign.id)} pendingLabel="Searching…">
                  Find more
                </ActionButton>
                {newCount > 0 && (
                  <ActionButton action={researchAndWrite.bind(null, campaign.id)} pendingLabel="Researching and writing…" variant="primary">
                    {`Research & write emails (${newCount} new)`}
                  </ActionButton>
                )}
              </div>
            ) : null
          }
        />
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Title</TH>
              <TH>Company</TH>
              <TH>Email</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <TBody>
            {list.length ? (
              list.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/dashboard/prospects/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    {p.is_demo && (
                      <span className="ml-2">
                        <DemoBadge />
                      </span>
                    )}
                  </TD>
                  <TD className="text-muted">{p.title ?? "—"}</TD>
                  <TD className="text-muted">{p.company ?? "—"}</TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-xs">{p.email ?? "—"}</span>
                      <EmailStatusBadge status={p.email_status} />
                    </div>
                  </TD>
                  <TD>
                    <ProspectBadge status={p.status} />
                  </TD>
                </TR>
              ))
            ) : (
              <TableEmpty colSpan={5}>
                {approved ? "No prospects yet. Click \"Find more\"." : "Approve the target profile to find prospects."}
              </TableEmpty>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
