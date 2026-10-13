"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile, requireUser } from "@/lib/auth";
import { isSuppressed, normalizeEmail, type SuppressionEntry } from "@/lib/email/rules";
import { logEvent } from "@/lib/events";
import { createSmtpTransport, describeMailError } from "@/lib/mail/connection";
import { loadMailboxConnection } from "@/lib/mail/mailbox-store";
import { assertPublicHost } from "@/lib/net/public-host";
import { footer, makeMessageId } from "@/lib/sending/compose";
import { unsubscribeUrl } from "@/lib/sending/unsubscribe-token";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Reply } from "@/lib/types";

export type ActionResult = { ok: boolean; message: string };
const uuid = z.string().uuid();

/**
 * Send the (possibly edited) answer to a reply, from the mailbox the reply arrived in, threaded
 * under it. One click by the user; still blocked for anyone on the do-not-contact list.
 */
export async function sendReplyDraft(replyId: string, body: string): Promise<ActionResult> {
  if (!uuid.safeParse(replyId).success) return { ok: false, message: "Unknown reply." };
  const text = body.replace(/\r\n/g, "\n").trim();
  if (!text) return { ok: false, message: "Write a message first." };
  if (text.length > 3000) return { ok: false, message: "That's too long for a reply." };

  const { supabase, user } = await requireUser();
  const profile = await requireProfile();
  const { data: reply } = await supabase.from("replies").select("*").eq("id", replyId).maybeSingle<Reply>();
  if (!reply) return { ok: false, message: "Unknown reply." };
  if (reply.draft_sent_at) return { ok: false, message: "Already sent." };
  if (reply.category === "unsubscribe" || reply.category === "not_interested") {
    return { ok: false, message: "This person asked not to be contacted." };
  }
  const { data: prospect } = await supabase.from("prospects").select("email, is_demo").eq("id", reply.prospect_id).maybeSingle();
  const to = normalizeEmail(reply.from_email ?? prospect?.email ?? "");
  if (!to.includes("@") || prospect?.is_demo) return { ok: false, message: "No address to reply to." };
  const { data: suppression } = await supabase.from("suppression").select("email, domain");
  if (isSuppressed(to, (suppression ?? []) as SuppressionEntry[])) return { ok: false, message: "This address is on your do-not-contact list." };
  if (!reply.mailbox_id) return { ok: false, message: "The mailbox this reply came to was removed." };

  const admin = createAdminClient();
  // Claim, so a double click can't send twice.
  const { data: claimed } = await admin
    .from("replies")
    .update({ draft_sent_at: new Date().toISOString(), draft_reply: text })
    .eq("id", replyId)
    .eq("user_id", user.id)
    .is("draft_sent_at", null)
    .select("id");
  if (!claimed?.length) return { ok: false, message: "Already sent." };

  try {
    const loaded = await loadMailboxConnection(user.id, reply.mailbox_id);
    if (!loaded) throw new Error("Mailbox not found.");
    await assertPublicHost(loaded.connection.smtpHost);
    const unsub = unsubscribeUrl(user.id, to);
    if (!unsub) throw new Error("APP_URL is not set.");
    const subject = reply.subject ? (/^re:/i.test(reply.subject) ? reply.subject : `Re: ${reply.subject}`) : "Re:";
    const transport = createSmtpTransport(loaded.connection);
    try {
      await transport.sendMail({
        from: { name: profile.sender_name, address: loaded.connection.email },
        to,
        subject: subject.replace(/[\r\n]+/g, " "),
        text: `${text}\n\n${footer({ senderName: profile.sender_name, companyName: profile.company_name, mailingAddress: profile.mailing_address, unsubscribeUrl: unsub })}\n`,
        messageId: makeMessageId(crypto.randomUUID(), loaded.connection.email),
        inReplyTo: reply.email_message_id,
        references: [reply.email_message_id],
        headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
    } finally {
      transport.close();
    }
  } catch (e) {
    await admin.from("replies").update({ draft_sent_at: null }).eq("id", replyId).eq("user_id", user.id);
    const msg = e instanceof Error && /APP_URL|Mailbox not found/.test(e.message) ? e.message : describeMailError(e, "SMTP");
    return { ok: false, message: `Not sent. ${msg}` };
  }

  await admin.from("replies").update({ handled: true }).eq("id", replyId).eq("user_id", user.id);
  await logEvent(user.id, "reply.answered", { reply_id: replyId });
  revalidatePath("/dashboard/inbox");
  return { ok: true, message: "Sent." };
}

export async function setReplyHandled(replyId: string, handled: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(replyId).success) return { ok: false, message: "Unknown reply." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("replies").update({ handled }).eq("id", replyId);
  if (error) return { ok: false, message: "Could not update." };
  revalidatePath("/dashboard/inbox");
  return { ok: true, message: handled ? "Marked handled." : "Marked open." };
}
