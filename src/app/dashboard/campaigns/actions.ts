"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AiError, planIcp } from "@/lib/ai";
import { runFinder } from "@/lib/agents/finder";
import { requireProfile, requireUser } from "@/lib/auth";
import { MissingEnvError } from "@/lib/env";
import { logEvent } from "@/lib/events";
import { buildSearchPlan, icpFromForm } from "@/lib/icp";
import { LeadProviderError } from "@/lib/leads";
import { senderFromProfile } from "@/lib/sender";

export type ActionResult = { ok: boolean; message: string };
export type CreateCampaignState = { message?: string; values?: Record<string, string> };

const uuid = z.string().uuid();

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the campaign a name.").max(200),
  description: z.string().trim().min(15, "Describe who you want to reach in a sentence or two.").max(5000),
  mailbox_id: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || uuid.safeParse(v).success, "Pick a mailbox."),
});

/** Turn known failures into a short message; anything else is generic (details stay in server logs). */
function explain(e: unknown): string {
  if (e instanceof MissingEnvError) return `Server setup: ${e.message.split(".")[0]}.`;
  if (e instanceof AiError || e instanceof LeadProviderError) return e.message;
  if (e instanceof Error && /Approve the target profile first|Campaign not found/.test(e.message)) return e.message;
  console.error("[campaigns]", e instanceof Error ? e.message : "unknown error");
  return "Something went wrong. Please try again.";
}

export async function createCampaign(_prev: CreateCampaignState, formData: FormData): Promise<CreateCampaignState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    mailbox_id: String(formData.get("mailbox_id") ?? ""),
  };
  const parsed = createSchema.safeParse(values);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Please check the form.", values };

  const { supabase, user } = await requireUser();
  const profile = await requireProfile();

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({ user_id: user.id, name: parsed.data.name, description: parsed.data.description, mailbox_id: parsed.data.mailbox_id })
    .select("id")
    .single();
  if (error || !campaign) return { message: "Could not create the campaign. Please try again.", values };
  await logEvent(user.id, "campaign.created", { campaign_id: campaign.id });

  // Planner agent: description → target customer profile. If it fails, the campaign page offers a
  // retry (which shows the reason); only a flag goes in the URL so links can't inject text.
  let planFailed = false;
  try {
    const icp = await planIcp({ sender: senderFromProfile(profile), description: parsed.data.description });
    await supabase.from("campaigns").update({ icp_json: icp }).eq("id", campaign.id);
    await logEvent(user.id, "planner.icp_created", { campaign_id: campaign.id });
  } catch (e) {
    console.error("[planner]", explain(e));
    planFailed = true;
  }

  revalidatePath("/dashboard/campaigns");
  redirect(`/dashboard/campaigns/${campaign.id}${planFailed ? "?plan_failed=1" : ""}`);
}

export async function regenerateIcp(campaignId: string): Promise<ActionResult> {
  if (!uuid.safeParse(campaignId).success) return { ok: false, message: "Unknown campaign." };
  const { supabase, user } = await requireUser();
  const profile = await requireProfile();
  const { data: campaign } = await supabase.from("campaigns").select("id, description").eq("id", campaignId).maybeSingle();
  if (!campaign) return { ok: false, message: "Unknown campaign." };
  try {
    const icp = await planIcp({ sender: senderFromProfile(profile), description: campaign.description });
    const { error } = await supabase.from("campaigns").update({ icp_json: icp }).eq("id", campaignId);
    if (error) return { ok: false, message: "Could not save the profile." };
    await logEvent(user.id, "planner.icp_created", { campaign_id: campaignId, regenerated: true });
    revalidatePath(`/dashboard/campaigns/${campaignId}`);
    return { ok: true, message: "New profile generated. Review it, then approve." };
  } catch (e) {
    return { ok: false, message: explain(e) };
  }
}

/** Save the (edited) profile, approve it, and run the Finder. */
export async function approveIcp(campaignId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(campaignId).success) return { ok: false, message: "Unknown campaign." };
  const { supabase, user } = await requireUser();

  const icp = icpFromForm(formData);
  if (!icp.titles.length && !icp.keywords.length && !icp.industries.length) {
    return { ok: false, message: "Add at least one job title, industry or keyword." };
  }
  const plan = buildSearchPlan(icp);

  const { data: existing } = await supabase.from("campaigns").select("search_plan_json").eq("id", campaignId).maybeSingle();
  if (!existing) return { ok: false, message: "Unknown campaign." };
  // A changed plan restarts paging from page 1 (dedupe prevents duplicates).
  const { error } = await supabase
    .from("campaigns")
    .update({
      icp_json: icp,
      search_plan_json: { ...plan, provider: "", next_page: 1, exhausted: false },
      icp_approved_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
  if (error) return { ok: false, message: "Could not save the profile." };
  await logEvent(user.id, "planner.icp_approved", { campaign_id: campaignId });

  return find(user.id, campaignId);
}

export async function findMore(campaignId: string): Promise<ActionResult> {
  if (!uuid.safeParse(campaignId).success) return { ok: false, message: "Unknown campaign." };
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("campaigns").select("id").eq("id", campaignId).maybeSingle();
  if (!data) return { ok: false, message: "Unknown campaign." };
  return find(user.id, campaignId);
}

async function find(userId: string, campaignId: string): Promise<ActionResult> {
  try {
    const r = await runFinder(userId, campaignId, 25);
    revalidatePath(`/dashboard/campaigns/${campaignId}`);
    const skipped = Object.entries(r.skipped)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${n} ${k.replaceAll("_", " ")}`)
      .join(", ");
    const more = r.exhausted ? " No more matches for this profile." : "";
    return {
      ok: true,
      message: `${r.provider}: added ${r.added} prospect${r.added === 1 ? "" : "s"}.${skipped ? ` Skipped: ${skipped}.` : ""}${more}`,
    };
  } catch (e) {
    revalidatePath(`/dashboard/campaigns/${campaignId}`);
    return { ok: false, message: explain(e) };
  }
}

export async function setCampaignMailbox(campaignId: string, mailboxId: string): Promise<ActionResult> {
  if (!uuid.safeParse(campaignId).success || (mailboxId && !uuid.safeParse(mailboxId).success)) {
    return { ok: false, message: "Unknown campaign or mailbox." };
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.from("campaigns").update({ mailbox_id: mailboxId || null }).eq("id", campaignId);
  if (error) return { ok: false, message: "Could not change the mailbox." };
  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  return { ok: true, message: "Mailbox updated." };
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  if (!uuid.safeParse(campaignId).success) return;
  const { supabase, user } = await requireUser();
  await supabase.from("campaigns").delete().eq("id", campaignId);
  await logEvent(user.id, "campaign.deleted", { campaign_id: campaignId });
  revalidatePath("/dashboard/campaigns");
  redirect("/dashboard/campaigns");
}
