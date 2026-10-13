"use client";

import { useActionState } from "react";
import { Button, Input, Textarea } from "@/ui";
import { SENIORITIES, type Icp } from "@/lib/icp";
import { approveIcp, type ActionResult } from "../actions";

const join = (list: string[] | undefined) => (list ?? []).join(", ");

export function IcpForm({ campaignId, icp, approved }: { campaignId: string; icp: Icp | null; approved: boolean }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(approveIcp.bind(null, campaignId), {
    ok: false,
    message: "",
  });

  return (
    <form action={action} className="flex flex-col gap-5">
      <Textarea name="summary" label="Summary" rows={2} defaultValue={icp?.summary ?? ""} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Textarea name="titles" label="Job titles" rows={3} defaultValue={join(icp?.titles)} hint="Comma or line separated." />
        <Textarea name="industries" label="Industries" rows={3} defaultValue={join(icp?.industries)} />
        <Textarea name="locations" label="Locations" rows={2} defaultValue={join(icp?.locations)} />
        <Textarea name="keywords" label="Company keywords" rows={2} defaultValue={join(icp?.keywords)} />
        <Input
          name="seniorities"
          label="Seniority"
          defaultValue={join(icp?.seniorities)}
          hint={`Any of: ${SENIORITIES.join(", ")}`}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input name="size_min" type="number" min={1} label="Min employees" defaultValue={icp?.company_size.min ?? ""} />
          <Input name="size_max" type="number" min={1} label="Max employees" defaultValue={icp?.company_size.max ?? ""} />
        </div>
      </div>
      <fieldset className="grid gap-5 rounded-md border border-border p-4 sm:grid-cols-3">
        <legend className="px-1 text-sm font-medium text-fg">Never contact</legend>
        <Textarea name="exclude_companies" label="Companies / domains" rows={2} defaultValue={join(icp?.exclusions.companies)} />
        <Textarea name="exclude_titles" label="Title words" rows={2} defaultValue={join(icp?.exclusions.titles)} />
        <Textarea name="exclude_keywords" label="Company keywords" rows={2} defaultValue={join(icp?.exclusions.keywords)} />
      </fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Finding prospects…" : approved ? "Save changes and find more" : "Approve and find prospects"}
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
