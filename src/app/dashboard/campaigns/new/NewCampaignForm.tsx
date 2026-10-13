"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Input, Textarea } from "@/ui";
import { controlStyles } from "@/ui/Field";
import { createCampaign, type CreateCampaignState } from "../actions";

export function NewCampaignForm({ mailboxes }: { mailboxes: { id: string; email: string; status: string }[] }) {
  const [state, action, pending] = useActionState<CreateCampaignState, FormData>(createCampaign, {});
  const v = state.values ?? {};

  return (
    <form action={action} className="flex flex-col gap-5">
      <Input name="name" label="Campaign name" placeholder="Logistics ops leaders – US" defaultValue={v.name} required maxLength={200} />
      <Textarea
        name="description"
        label="Describe who you want to reach"
        placeholder="Operations leaders at mid-size trucking and logistics companies (50–500 employees) in the US Midwest who manage their own fleet. Not interested in freight brokers."
        rows={6}
        defaultValue={v.description}
        required
        maxLength={5000}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="mailbox_id" className="text-sm font-medium text-fg">
          Send from
        </label>
        <select id="mailbox_id" name="mailbox_id" defaultValue={v.mailbox_id ?? mailboxes[0]?.id ?? ""} className={`${controlStyles} h-10`}>
          <option value="">Choose later</option>
          {mailboxes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.email}
              {m.status !== "active" ? ` (${m.status})` : ""}
            </option>
          ))}
        </select>
        {mailboxes.length === 0 && (
          <p className="text-xs text-muted">
            No mailbox yet. <Link href="/dashboard/mailboxes" className="text-accent hover:underline">Connect one</Link> before sending.
          </p>
        )}
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Planning…" : "Create and plan"}
        </Button>
        {state.message && <p className="text-sm text-danger">{state.message}</p>}
      </div>
    </form>
  );
}
