import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile, requireUser } from "@/lib/auth";
import { listTimezones } from "@/lib/timezones";
import { Card, CardBody, Nav } from "@/ui";
import { SignOutButton } from "../SignOutButton";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Set up your account" };

export default async function OnboardingPage() {
  await requireUser();
  const profile = await getProfile();
  if (profile?.onboarded_at) redirect("/dashboard");

  return (
    <>
      <Nav actions={<SignOutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Step 1 of 1</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Tell us about your business</h1>
        <p className="mt-2 text-sm text-muted">
          This is what the agents work from. You can change it any time in Settings.
        </p>
        <Card className="mt-8">
          <CardBody className="py-6">
            <ProfileForm mode="onboarding" profile={profile} timezones={listTimezones()} />
          </CardBody>
        </Card>
      </main>
    </>
  );
}
