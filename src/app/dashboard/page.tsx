import type { Metadata } from "next";
import { Badge, Button, Card, CardBody, CardHeader, Table, TableEmpty, TBody, TH, THead } from "@/ui";

export const metadata: Metadata = { title: "Dashboard" };

const stats = [
  { label: "Prospects", hint: "found and verified" },
  { label: "Emails sent", hint: "today / daily cap" },
  { label: "Replies", hint: "all categories" },
  { label: "Interested", hint: "offered your Calendly" },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted">Everything your agents are doing, in one place.</p>
        </div>
        <Badge tone="neutral">Preview: no data yet</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardBody>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{s.label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-subtle">—</p>
              <p className="mt-1 text-xs text-subtle">{s.hint}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Campaigns"
          description="Each campaign describes who you want to reach."
          action={
            <Button size="sm" disabled>
              New campaign
            </Button>
          }
        />
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Status</TH>
              <TH>Prospects</TH>
              <TH>Sent</TH>
              <TH>Replies</TH>
            </tr>
          </THead>
          <TBody>
            <TableEmpty colSpan={5}>No campaigns yet.</TableEmpty>
          </TBody>
        </Table>
      </Card>

      <Card>
        <CardHeader title="Recent replies" description="Sorted automatically: interested, not now, not interested, unsubscribe, out of office." />
        <Table>
          <THead>
            <tr>
              <TH>From</TH>
              <TH>Category</TH>
              <TH>Snippet</TH>
              <TH>Received</TH>
            </tr>
          </THead>
          <TBody>
            <TableEmpty colSpan={4}>No replies yet.</TableEmpty>
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
