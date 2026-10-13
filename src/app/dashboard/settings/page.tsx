import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { listTimezones } from "@/lib/timezones";
import { Card, CardBody, CardHeader } from "@/ui";
import { ProfileForm } from "../../onboarding/ProfileForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await requireProfile();

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">Your business details. The agents use these for every campaign.</p>
      </div>
      <Card>
        <CardHeader title="Business profile" />
        <CardBody className="py-6">
          <ProfileForm mode="settings" profile={profile} timezones={listTimezones()} />
        </CardBody>
      </Card>
    </div>
  );
}
