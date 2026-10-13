import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { Prospect } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/ui";
import { DemoBadge, EmailStatusBadge, ProspectBadge } from "../../badges";

export const metadata: Metadata = { title: "Prospect" };

export default async function ProspectPage({ params }: PageProps<"/dashboard/prospects/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: p } = await supabase.from("prospects").select("*").eq("id", id).maybeSingle<Prospect>();
  if (!p) notFound();

  const rows: Array<[string, React.ReactNode]> = [
    ["Title", p.title],
    ["Company", p.company],
    ["Domain", p.domain],
    ["Location", p.location],
    ["Timezone", p.timezone],
    ["Email", p.email && <span className="flex items-center gap-2 font-mono text-xs">{p.email} <EmailStatusBadge status={p.email_status} /></span>],
    ["LinkedIn", p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Profile</a>],
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
    </div>
  );
}
