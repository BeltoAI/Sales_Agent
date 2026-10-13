import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { Card, CardBody } from "@/ui";
import { NewCampaignForm } from "./NewCampaignForm";

export const metadata: Metadata = { title: "New campaign" };
export const maxDuration = 60;

export default async function NewCampaignPage() {
  const { supabase } = await requireUser();
  const { data: mailboxes } = await supabase.from("mailboxes").select("id, email, status").order("created_at");

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
        <p className="mt-1 text-sm text-muted">
          Describe who you want to reach in plain words. The planner turns it into a target customer profile you can
          edit and approve before anyone is searched for.
        </p>
      </div>
      <Card>
        <CardBody className="py-6">
          <NewCampaignForm mailboxes={mailboxes ?? []} />
        </CardBody>
      </Card>
    </div>
  );
}
