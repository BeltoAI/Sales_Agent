"use client";

import { useState, useTransition } from "react";
import { controlStyles } from "@/ui/Field";

export function MailboxPicker({
  mailboxes,
  value,
  onChange,
}: {
  mailboxes: { id: string; email: string; status: string }[];
  value: string;
  onChange: (mailboxId: string) => Promise<{ ok: boolean; message: string }>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex items-center gap-2 text-sm text-muted">
        Send from
        <select
          defaultValue={value}
          disabled={pending}
          onChange={(e) => {
            const id = e.target.value;
            start(async () => {
              const r = await onChange(id);
              setError(r.ok ? null : r.message);
            });
          }}
          className={`${controlStyles} h-8 w-64`}
        >
          <option value="">No mailbox</option>
          {mailboxes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.email}
              {m.status !== "active" ? ` (${m.status})` : ""}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
