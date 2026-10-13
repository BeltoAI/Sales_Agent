import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import type { Reply, ReplyCategory } from "@/lib/types";
import { Card, CardBody, cn } from "@/ui";
import { ActionButton } from "../ActionButton";
import { ReplyBadge } from "../badges";
import { setReplyHandled } from "./actions";
import { ReplyComposer } from "./ReplyComposer";

export const metadata: Metadata = { title: "Inbox" };
export const maxDuration = 60;

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "open", label: "Needs attention" },
  { key: "interested", label: "Interested" },
  { key: "not_now", label: "Not now" },
  { key: "not_interested", label: "Not interested" },
  { key: "unsubscribe", label: "Unsubscribed" },
  { key: "out_of_office", label: "Out of office" },
  { key: "all", label: "All" },
];

export default async function InboxPage({ searchParams }: PageProps<"/dashboard/inbox">) {
  const { filter: raw } = await searchParams;
  const filter = typeof raw === "string" && FILTERS.some((f) => f.key === raw) ? raw : "open";
  const { supabase } = await requireUser();

  let q = supabase.from("replies").select("*").order("received_at", { ascending: false }).limit(200);
  if (filter === "open") q = q.eq("handled", false);
  else if (filter !== "all") q = q.eq("category", filter as ReplyCategory);
  const { data } = await q;
  const replies = (data ?? []) as Reply[];

  const ids = Array.from(new Set(replies.map((r) => r.prospect_id)));
  const { data: prospects } = ids.length
    ? await supabase.from("prospects").select("id, name, company, title").in("id", ids)
    : { data: [] as { id: string; name: string; company: string | null; title: string | null }[] };
  const byId = new Map((prospects ?? []).map((p) => [p.id, p]));

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-muted">
          Replies are read from your mailbox and sorted automatically. Any reply stops that person&apos;s sequence. Interested
          people get a drafted answer with your Calendly link for you to send.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1" aria-label="Filter replies">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/dashboard/inbox?filter=${f.key}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              filter === f.key ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {replies.length === 0 && (
        <Card>
          <CardBody className="py-10 text-center text-sm text-muted">Nothing here yet.</CardBody>
        </Card>
      )}

      {replies.map((r) => {
        const p = byId.get(r.prospect_id);
        const canAnswer = r.category === "interested" && !r.draft_sent_at;
        return (
          <Card key={r.id} className={r.handled ? "opacity-70" : undefined}>
            <CardBody className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ReplyBadge category={r.category} />
                    <Link href={`/dashboard/prospects/${r.prospect_id}`} className="font-medium hover:underline">
                      {p?.name ?? r.from_email}
                    </Link>
                    {p?.company && <span className="text-sm text-muted">· {p.company}</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {r.from_email} · {new Date(r.received_at).toLocaleString()}
                    {r.ooo_return_date ? ` · back ${r.ooo_return_date}` : ""}
                  </p>
                </div>
                {!canAnswer && (
                  <ActionButton action={setReplyHandled.bind(null, r.id, !r.handled)} variant="ghost">
                    {r.handled ? "Mark open" : "Mark handled"}
                  </ActionButton>
                )}
              </div>
              {r.subject && <p className="text-sm font-medium">{r.subject}</p>}
              <p className="text-sm whitespace-pre-wrap text-muted">{r.snippet}</p>
              {canAnswer && (
                <div className="rounded-md border border-border p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Your answer (edit before sending)</p>
                  <ReplyComposer replyId={r.id} draft={r.draft_reply ?? ""} />
                </div>
              )}
              {r.draft_sent_at && <p className="text-xs text-success">Answered {new Date(r.draft_sent_at).toLocaleString()}.</p>}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
