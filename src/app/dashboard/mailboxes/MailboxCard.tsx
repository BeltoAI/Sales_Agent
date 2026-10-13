"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Card, CardBody, CardHeader } from "@/ui";
import { controlStyles } from "@/ui/Field";
import type { Mailbox } from "@/lib/types";
import { deleteMailbox, sendTestEmail, setDailyCap, setMailboxPaused, testMailbox, type ActionResult } from "./actions";

const STATUS_TONE = { active: "success", paused: "warning", error: "danger" } as const;

export function MailboxCard({ mailbox }: { mailbox: Mailbox }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [cap, setCap] = useState(String(mailbox.daily_cap));

  const run = (fn: () => Promise<ActionResult>) => start(async () => setResult(await fn()));

  return (
    <Card>
      <CardHeader
        title={mailbox.email}
        description={`SMTP ${mailbox.smtp_host}:${mailbox.smtp_port} · IMAP ${mailbox.imap_host}:${mailbox.imap_port}`}
        action={<Badge tone={STATUS_TONE[mailbox.status]}>{mailbox.status}</Badge>}
      />
      <CardBody className="flex flex-col gap-4">
        {mailbox.status_reason && <p className="text-sm text-warning">{mailbox.status_reason}</p>}
        {mailbox.last_error && <p className="text-sm text-danger">Last check: {mailbox.last_error}</p>}

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`cap-${mailbox.id}`} className="text-xs text-muted">
              Daily cap (max 50)
            </label>
            <input
              id={`cap-${mailbox.id}`}
              type="number"
              min={1}
              max={50}
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              className={`${controlStyles} h-8 w-24`}
            />
          </div>
          <Button size="sm" variant="secondary" disabled={pending || cap === String(mailbox.daily_cap)} onClick={() => run(() => setDailyCap(mailbox.id, Number(cap)))}>
            Save cap
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => testMailbox(mailbox.id))}>
            Test connection
          </Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => sendTestEmail(mailbox.id))}>
            Send me a test email
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => setMailboxPaused(mailbox.id, mailbox.status === "active"))}
          >
            {mailbox.status === "active" ? "Pause" : "Resume"}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (confirm(`Remove ${mailbox.email}? Campaigns using it will stop sending.`)) run(() => deleteMailbox(mailbox.id));
            }}
          >
            Remove
          </Button>
        </div>

        {pending && <p className="text-sm text-muted">Working…</p>}
        {!pending && result && (
          <p role="status" className={`text-sm ${result.ok ? "text-success" : "text-danger"}`}>
            {result.message}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
