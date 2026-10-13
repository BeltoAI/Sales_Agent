import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { MAILBOX_PUBLIC_COLUMNS, type Mailbox } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/ui";
import { ConnectMailboxForm } from "./ConnectMailboxForm";
import { MailboxCard } from "./MailboxCard";

export const metadata: Metadata = { title: "Mailboxes" };
// SMTP + IMAP checks can take a while on slow servers.
export const maxDuration = 60;

export default async function MailboxesPage() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("mailboxes")
    .select(MAILBOX_PUBLIC_COLUMNS)
    .order("created_at", { ascending: true });
  const mailboxes = (data ?? []) as Mailbox[];

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mailboxes</h1>
        <p className="mt-1 text-sm text-muted">
          Emails are sent from your own mailbox over SMTP, and replies are read over IMAP.
        </p>
      </div>

      {error && <p className="text-sm text-danger">Could not load mailboxes.</p>}
      {mailboxes.map((m) => (
        <MailboxCard key={`${m.id}-${m.updated_at}`} mailbox={m} />
      ))}

      <Card>
        <CardHeader
          title={mailboxes.length ? "Connect another mailbox" : "Connect your mailbox"}
          description="We test both sending and reading before saving anything."
        />
        <CardBody className="py-6">
          <ConnectMailboxForm />
        </CardBody>
      </Card>
    </div>
  );
}
