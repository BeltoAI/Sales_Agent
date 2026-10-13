import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile, requireUser } from "@/lib/auth";
import { safeTimezone, startOfLocalDay } from "@/lib/sending/schedule";
import { computeStats, percent } from "@/lib/stats";
import { MAILBOX_PUBLIC_COLUMNS, type Campaign, type EventRow, type Mailbox } from "@/lib/types";
import { Badge, Card, CardBody, CardHeader, LinkButton, Meter, StatTile, Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/ui";
import { CampaignBadge } from "./badges";
import { describeEvent, isProblem } from "./events";

export const metadata: Metadata = { title: "Dashboard" };

const MAILBOX_STATUS = {
  active: { tone: "success", label: "● Active" },
  paused: { tone: "warning", label: "❚❚ Paused" },
  error: { tone: "danger", label: "▲ Error" },
} as const;

export default async function DashboardPage() {
  const { supabase } = await requireUser();
  const profile = await requireProfile();
  const tz = safeTimezone(profile.timezone);
  const dayStart = startOfLocalDay(new Date(), tz).toISOString();

  const [{ data: campaigns }, { data: prospects }, { data: messages }, { data: replies }, { data: mailboxes }, { data: events }, { data: today }] =
    await Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("prospects").select("id, campaign_id").limit(10_000),
      supabase.from("messages").select("campaign_id, status, sent_at, bounced_at").in("status", ["sent", "failed"]).limit(20_000),
      supabase.from("replies").select("prospect_id, category, handled").limit(10_000),
      supabase.from("mailboxes").select(MAILBOX_PUBLIC_COLUMNS).order("created_at"),
      supabase.from("events").select("*").order("created_at", { ascending: false }).limit(40),
      supabase.from("messages").select("mailbox_id, sent_at, bounced_at").or(`sent_at.gte.${dayStart},bounced_at.gte.${dayStart}`).limit(5_000),
    ]);

  const { byCampaign, total } = computeStats(prospects ?? [], messages ?? [], replies ?? []);
  const openReplies = (replies ?? []).filter((r) => !r.handled).length;

  const mailboxToday = new Map<string, { attempted: number; bounced: number }>();
  for (const m of today ?? []) {
    if (!m.mailbox_id) continue;
    const t = mailboxToday.get(m.mailbox_id) ?? { attempted: 0, bounced: 0 };
    if ((m.sent_at && m.sent_at >= dayStart) || (!m.sent_at && m.bounced_at)) t.attempted++;
    if (m.bounced_at && m.bounced_at >= dayStart) t.bounced++;
    mailboxToday.set(m.mailbox_id, t);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted">Everything your agents are doing, in one place.</p>
        </div>
        <div className="flex gap-2">
          {openReplies > 0 && (
            <LinkButton href="/dashboard/inbox" variant="secondary">
              {openReplies} repl{openReplies === 1 ? "y" : "ies"} to review
            </LinkButton>
          )}
          <LinkButton href="/dashboard/campaigns/new">New campaign</LinkButton>
        </div>
      </div>

      <section aria-label="Totals" className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Prospects" value={total.prospects} hint="found across campaigns" />
        <StatTile label="Emails sent" value={total.sent} hint="all steps" />
        <StatTile label="Replies" value={total.replies} hint="people, excl. out of office" />
        <StatTile label="Interested" value={total.interested} hint="offered your Calendly" />
        <StatTile label="Bounce rate" value={percent(total.bounceRate)} hint={`${total.bounces} bounce${total.bounces === 1 ? "" : "s"}`} />
      </section>

      <Card>
        <CardHeader title="Campaigns" />
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Status</TH>
              <TH className="text-right">Prospects</TH>
              <TH className="text-right">Sent</TH>
              <TH className="text-right">Replies</TH>
              <TH className="text-right">Interested</TH>
              <TH className="text-right">Bounces</TH>
            </tr>
          </THead>
          <TBody>
            {(campaigns as Campaign[] | null)?.length ? (
              (campaigns as Campaign[]).map((c) => {
                const s = byCampaign.get(c.id);
                return (
                  <TR key={c.id}>
                    <TD>
                      <Link href={`/dashboard/campaigns/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    </TD>
                    <TD>
                      <CampaignBadge status={c.status} />
                    </TD>
                    <TD className="text-right tabular-nums">{s?.prospects ?? 0}</TD>
                    <TD className="text-right tabular-nums">{s?.sent ?? 0}</TD>
                    <TD className="text-right tabular-nums">{s?.replies ?? 0}</TD>
                    <TD className="text-right tabular-nums">{s?.interested ?? 0}</TD>
                    <TD className="text-right tabular-nums">
                      {s?.bounces ?? 0}
                      {s && s.bounces > 0 && <span className="ml-1 text-xs text-muted">({percent(s.bounceRate)})</span>}
                    </TD>
                  </TR>
                );
              })
            ) : (
              <TableEmpty colSpan={7}>
                No campaigns yet. <Link href="/dashboard/campaigns/new" className="text-accent hover:underline">Create one</Link>.
              </TableEmpty>
            )}
          </TBody>
        </Table>
      </Card>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="Mailbox health" description={`Today in ${tz.replaceAll("_", " ")}. Max 50 per mailbox; auto-pause above 5% bounces.`} />
          <CardBody className="flex flex-col gap-6">
            {(mailboxes as Mailbox[] | null)?.length ? (
              (mailboxes as Mailbox[]).map((m) => {
                const t = mailboxToday.get(m.id) ?? { attempted: 0, bounced: 0 };
                const st = MAILBOX_STATUS[m.status];
                return (
                  <div key={m.id} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <Link href="/dashboard/mailboxes" className="truncate text-sm font-medium hover:underline">
                        {m.email}
                      </Link>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <Meter value={t.attempted} max={m.daily_cap} label="Sent today / daily cap" />
                    <p className="text-xs text-muted">
                      Bounces today: <span className="text-fg tabular-nums">{t.bounced}</span>
                      {t.attempted > 0 && ` (${percent(t.bounced / t.attempted)})`} · Last checked{" "}
                      {m.last_checked_at ? new Date(m.last_checked_at).toLocaleString() : "never"}
                    </p>
                    {m.status_reason && <p className="text-xs text-warning">{m.status_reason}</p>}
                    {m.last_error && <p className="text-xs text-danger">{m.last_error}</p>}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted">
                No mailbox connected. <Link href="/dashboard/mailboxes" className="text-accent hover:underline">Connect one</Link> to send.
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Activity" description="The audit log of everything the agents did (latest 40)." />
          <CardBody className="p-0">
            {(events as EventRow[] | null)?.length ? (
              <ol className="divide-y divide-border">
                {(events as EventRow[]).map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-4 px-5 py-2.5 text-sm">
                    <span className={isProblem(e.type) ? "text-danger" : "text-fg"}>{describeEvent(e)}</span>
                    <time className="shrink-0 text-xs text-muted tabular-nums" dateTime={e.created_at}>
                      {new Date(e.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-5 py-10 text-center text-sm text-muted">Nothing yet.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
