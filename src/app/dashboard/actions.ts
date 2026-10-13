"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logEvent } from "@/lib/events";

/** Global pause switch. The sender checks profiles.sending_paused before every email. */
export async function setSendingPaused(paused: boolean): Promise<{ ok: boolean; message: string }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({ sending_paused: Boolean(paused) }).eq("user_id", user.id);
  if (error) return { ok: false, message: "Could not change the switch." };
  await logEvent(user.id, paused ? "sending.paused_all" : "sending.resumed_all", {});
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: paused ? "All sending paused." : "Sending resumed." };
}
