"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, Input, Textarea } from "@/ui";
import { controlStyles } from "@/ui/Field";
import type { Profile } from "@/lib/types";
import { saveProfile, type ProfileFormState } from "./actions";

export function ProfileForm({
  mode,
  profile,
  timezones,
}: {
  mode: "onboarding" | "settings";
  profile: Profile | null;
  timezones: string[];
}) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(saveProfile, {});
  const tzRef = useRef<HTMLSelectElement>(null);

  // New users: preselect the browser's timezone (the server can't know it).
  useEffect(() => {
    if (profile?.timezone || !tzRef.current) return;
    const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (guess && timezones.includes(guess)) tzRef.current.value = guess;
  }, [profile?.timezone, timezones]);

  // After a failed submit, show what the user typed; otherwise the saved profile.
  const v = (field: keyof Profile) => state.values?.[field] ?? (profile?.[field] as string | null | undefined) ?? "";
  const err = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="mode" value={mode} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input name="company_name" label="Company name" defaultValue={v("company_name")} error={err.company_name} required />
        <Input
          name="website"
          label="Website"
          placeholder="acme.com"
          defaultValue={v("website")}
          error={err.website}
          hint="Optional"
        />
      </div>

      <Textarea
        name="what_they_sell"
        label="What do you sell?"
        placeholder="We help mid-size logistics companies cut fuel costs with route-planning software…"
        rows={4}
        defaultValue={v("what_they_sell")}
        error={err.what_they_sell}
        hint="A few plain sentences. The agents use this to plan who to reach and what to say."
        required
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          name="sender_name"
          label="Sender name"
          placeholder="Jane Doe"
          defaultValue={v("sender_name")}
          error={err.sender_name}
          hint="The name your emails come from."
          required
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="timezone" className="text-sm font-medium text-fg">
            Your timezone
          </label>
          <select
            id="timezone"
            name="timezone"
            ref={tzRef}
            defaultValue={v("timezone") || "UTC"}
            className={`${controlStyles} h-10`}
            aria-invalid={err.timezone ? true : undefined}
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          {err.timezone && <p className="text-xs text-danger">{err.timezone}</p>}
        </div>
      </div>

      <Textarea
        name="mailing_address"
        label="Physical mailing address"
        placeholder={"Acme Inc.\n123 Main St\nSpringfield, IL 62701, USA"}
        rows={3}
        defaultValue={v("mailing_address")}
        error={err.mailing_address}
        hint="Required by anti-spam law. It appears in the footer of every email."
        required
      />

      <Input
        name="calendly_url"
        label="Calendly link"
        placeholder="https://calendly.com/you/intro"
        defaultValue={v("calendly_url")}
        error={err.calendly_url}
        hint="Optional for now. Offered to people who reply that they're interested."
      />

      <div className="flex items-center gap-4 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "onboarding" ? "Save and continue" : "Save changes"}
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
