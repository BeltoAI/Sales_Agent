"use client";

import { useActionState, useState } from "react";
import { Button, Input } from "@/ui";
import { controlStyles } from "@/ui/Field";
import { MAIL_PRESETS } from "@/lib/mail/presets";
import { connectMailbox, type ConnectState } from "./actions";

export function ConnectMailboxForm() {
  const [state, action, pending] = useActionState<ConnectState, FormData>(connectMailbox, { ok: false, message: "" });
  const [presetId, setPresetId] = useState("google");
  const preset = MAIL_PRESETS.find((p) => p.id === presetId) ?? MAIL_PRESETS[0];
  const err = state.fieldErrors ?? {};
  const v = (k: string) => state.values?.[k];

  return (
    // key: reset uncontrolled inputs to the preset's values when the provider changes.
    <form action={action} className="flex flex-col gap-5" key={presetId} noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="preset" className="text-sm font-medium text-fg">
          Provider
        </label>
        <select
          id="preset"
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
          className={`${controlStyles} h-10`}
        >
          {MAIL_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">{preset.help}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input name="email" type="email" label="Email address" placeholder="you@company.com" defaultValue={v("email")} error={err.email} autoComplete="off" />
        <Input
          name="password"
          type="password"
          label="App password"
          error={err.password}
          autoComplete="new-password"
          hint="Encrypted before it's stored. Never shown again."
        />
      </div>

      <details className="rounded-md border border-border px-4 py-3" open={presetId === "custom"}>
        <summary className="cursor-pointer text-sm text-muted">Server settings</summary>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Input name="smtp_host" label="SMTP server" defaultValue={v("smtp_host") ?? preset.smtpHost} error={err.smtp_host} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="smtp_port" className="text-sm font-medium text-fg">
              SMTP port
            </label>
            <select id="smtp_port" name="smtp_port" defaultValue={v("smtp_port") ?? String(preset.smtpPort)} className={`${controlStyles} h-10`}>
              <option value="465">465 (SSL/TLS)</option>
              <option value="587">587 (STARTTLS)</option>
            </select>
          </div>
          <Input name="imap_host" label="IMAP server (port 993)" defaultValue={v("imap_host") ?? preset.imapHost} error={err.imap_host} />
          <Input name="username" label="Username" placeholder="Same as email" defaultValue={v("username")} error={err.username} hint="Leave blank to use the email address." />
        </div>
      </details>

      <Input
        name="daily_cap"
        type="number"
        min={1}
        max={50}
        label="Daily sending cap"
        defaultValue={v("daily_cap") ?? "30"}
        error={err.daily_cap}
        hint="Default 30, maximum 50 emails per day from this mailbox."
        className="max-w-32"
      />

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Testing connection…" : "Test and connect"}
        </Button>
        {state.message && (
          <p role="status" className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
