import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { Message, Prospect, Reply } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/ui";
import { ActionButton } from "../../ActionButton";
import { DemoBadge, EmailStatusBadge, MessageBadge, ProspectBadge, ReplyBadge } from "../../badges";
import { rewriteEmails } from "../actions";
import { MessageEditor } from "./MessageEditor";

export const metadata: Metadata = { title: "Prospect" };
export const maxDuration = 60;

const STEP_LABEL = { 1: "First email", 2: "Follow-up 1", 3: "Follow-up 2" } as const;

/** Only render http(s) links (research URLs come from the internet). */
function SafeLink({ href }: { href: string | null }) {
  if (!href || !/^https?:\/\//i.test(href)) return <span className="text-muted">{href ?? "—"}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-accent hover:underline">
      {href}
    </a>
  );
}

export default async function ProspectPage({ params }: PageProps<"/dashboard/prospects/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: p } = await supabase.from("prospects").select("*").eq("id", id).maybeSingle<Prospect>();
  if (!p) notFound();

  const [{ data: messages }, { data: replies }] = await Promise.all([
    supabase.from("messages").select("*").eq("prospect_id", id).order("step"),
    supabase.from("replies").select("*").eq("prospect_id", id).order("received_at", { ascending: false }),
  ]);
  const msgs = (messages ?? []) as Message[];
  const canRewrite = ["new", "ready", "excluded"].includes(p.status) && msgs.every((m) => m.status === "draft");

  const rows: Array<[string, React.ReactNode]> = [
    ["Title", p.title],
    ["Company", p.company],
    ["Domain", p.domain],
    ["Location", p.location],
    ["Timezone", p.timezone],
    ["Email", p.email && <span className="flex items-center gap-2 font-mono text-xs">{p.email} <EmailStatusBadge status={p.email_status} /></span>],
    ["LinkedIn", p.linkedin_url && <SafeLink href={p.linkedin_url} />],
    ["Source", p.source],
  ];

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <div>
        <Link href={`/dashboard/campaigns/${p.campaign_id}`} className="text-sm text-muted hover:text-fg">
          ← Campaign
        </Link>
        <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
          {p.name} <ProspectBadge status={p.status} /> {p.is_demo && <DemoBadge />}
        </h1>
        {p.resume_at && p.status === "paused" && (
          <p className="mt-2 text-sm text-warning">Out of office. Sequence resumes {new Date(p.resume_at).toLocaleDateString()}.</p>
        )}
      </div>

      <Card>
        <CardHeader title="Details" />
        <CardBody>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd>{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Research"
          description={p.researched_at ? `Researched ${new Date(p.researched_at).toLocaleString()} from the company website.` : "Not researched yet."}
          action={
            canRewrite ? (
              <ActionButton action={rewriteEmails.bind(null, p.id, true)} pendingLabel="Researching…">
                {p.researched_at ? "Research again and rewrite" : "Research and write"}
              </ActionButton>
            ) : null
          }
        />
        <CardBody className="flex flex-col gap-4 text-sm">
          {p.personal_detail ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Specific detail to mention</p>
              <p className="mt-1">{p.personal_detail}</p>
              <p className="mt-1 text-xs">
                Source: <SafeLink href={p.research_source_url} />
              </p>
            </div>
          ) : (
            p.researched_at && <p className="text-muted">No specific, verifiable detail found. Emails stay generic and honest.</p>
          )}
          {p.research_notes && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Notes (the only facts the writer may use)</p>
              <pre className="mt-1 font-sans whitespace-pre-wrap text-fg">{p.research_notes}</pre>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Emails"
          description="A short first email and two follow-ups, each at least 3 business days apart."
          action={
            canRewrite && msgs.length ? (
              <ActionButton action={rewriteEmails.bind(null, p.id, false)} pendingLabel="Writing…">
                Rewrite emails
              </ActionButton>
            ) : null
          }
        />
        <CardBody className="flex flex-col gap-8 py-6">
          {msgs.length === 0 && <p className="text-sm text-muted">No emails yet. Use &quot;Research & write&quot; on the campaign page.</p>}
          {msgs.map((m) => (
            <section key={`${m.id}-${m.updated_at}`} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-sm font-semibold">{STEP_LABEL[m.step]}</h3>
                <MessageBadge status={m.status} />
                {m.scheduled_at && m.status === "scheduled" && <span className="text-xs text-muted">sends {new Date(m.scheduled_at).toLocaleString()}</span>}
                {m.sent_at && <span className="text-xs text-muted">sent {new Date(m.sent_at).toLocaleString()}</span>}
                {m.error && <span className="text-xs text-danger">{m.error}</span>}
              </div>
              <MessageEditor message={m} />
            </section>
          ))}
        </CardBody>
      </Card>

      {(replies ?? []).length > 0 && (
        <Card>
          <CardHeader title="Replies" />
          <CardBody className="flex flex-col gap-4">
            {(replies as Reply[]).map((r) => (
              <div key={r.id} className="flex flex-col gap-1 text-sm">
                <div className="flex items-center gap-2">
                  <ReplyBadge category={r.category} />
                  <span className="text-xs text-muted">{new Date(r.received_at).toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap text-muted">{r.snippet}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
