"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProfile, requireUser } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { logEvent } from "@/lib/events";
import { createSmtpTransport, describeMailError, testImap, testSmtp, type MailboxConnection } from "@/lib/mail/connection";
import { credentialAad, loadMailboxConnection, recordMailboxCheck } from "@/lib/mail/mailbox-store";
import { assertPublicHost } from "@/lib/net/public-host";
import { connectMailboxSchema, dailyCapSchema } from "@/lib/validation/mailbox";

export type ActionResult = { ok: boolean; message: string };
export type ConnectState = ActionResult & { fieldErrors?: Record<string, string>; values?: Record<string, string> };

const uuid = z.string().uuid();
const PATH = "/dashboard/mailboxes";

/** Test SMTP then IMAP. Returns a user-facing error, or null when both work. */
async function checkConnection(c: MailboxConnection): Promise<string | null> {
  try {
    await assertPublicHost(c.smtpHost);
    await testSmtp(c);
  } catch (e) {
    return describeMailError(e, "SMTP");
  }
  try {
    await assertPublicHost(c.imapHost);
    await testImap(c);
  } catch (e) {
    return describeMailError(e, "IMAP");
  }
  return null;
}

export async function connectMailbox(_prev: ConnectState, formData: FormData): Promise<ConnectState> {
  const raw = Object.fromEntries(
    ["email", "username", "password", "smtp_host", "smtp_port", "imap_host", "daily_cap"].map((k) => [
      k,
      String(formData.get(k) ?? ""),
    ]),
  );
  // Never send the password back to the browser.
  const values = { ...raw, password: "" };

  const parsed = connectMailboxSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors, values };
  }

  const { user, supabase } = await requireUser();
  const input = parsed.data;
  const connection: MailboxConnection = {
    email: input.email,
    username: input.username ?? input.email,
    password: input.password,
    smtpHost: input.smtp_host,
    smtpPort: input.smtp_port,
    imapHost: input.imap_host,
    imapPort: 993,
  };

  // Only save credentials that actually work.
  const problem = await checkConnection(connection);
  if (problem) return { ok: false, message: problem, values };

  const { error } = await supabase.from("mailboxes").insert({
    user_id: user.id,
    email: connection.email,
    username: connection.username,
    smtp_host: connection.smtpHost,
    smtp_port: connection.smtpPort,
    imap_host: connection.imapHost,
    imap_port: 993,
    daily_cap: input.daily_cap,
    encrypted_credentials: encrypt(connection.password, credentialAad(user.id)),
  });
  if (error) {
    const message = error.code === "23505" ? "This mailbox is already connected." : "Could not save the mailbox. Please try again.";
    return { ok: false, message, values };
  }

  await logEvent(user.id, "mailbox.connected", { email: connection.email, smtp_host: connection.smtpHost });
  revalidatePath(PATH);
  return { ok: true, message: "Mailbox connected. SMTP and IMAP both work." };
}

export async function testMailbox(mailboxId: string): Promise<ActionResult> {
  if (!uuid.safeParse(mailboxId).success) return { ok: false, message: "Unknown mailbox." };
  const { user } = await requireUser();
  try {
    const loaded = await loadMailboxConnection(user.id, mailboxId);
    if (!loaded) return { ok: false, message: "Unknown mailbox." };
    const problem = await checkConnection(loaded.connection);
    await recordMailboxCheck(user.id, mailboxId, problem);
    revalidatePath(PATH);
    return problem ? { ok: false, message: problem } : { ok: true, message: "SMTP and IMAP both work." };
  } catch (e) {
    return { ok: false, message: serverProblem(e) };
  }
}

export async function sendTestEmail(mailboxId: string): Promise<ActionResult> {
  if (!uuid.safeParse(mailboxId).success) return { ok: false, message: "Unknown mailbox." };
  const { user } = await requireUser();
  const profile = await getProfile();
  if (!user.email) return { ok: false, message: "Your account has no email address to send the test to." };

  try {
    const loaded = await loadMailboxConnection(user.id, mailboxId);
    if (!loaded) return { ok: false, message: "Unknown mailbox." };
    const { connection } = loaded;

    await assertPublicHost(connection.smtpHost);
    const transport = createSmtpTransport(connection);
    try {
      await transport.sendMail({
        from: { name: profile?.sender_name ?? connection.email, address: connection.email },
        to: user.email,
        subject: "Sales Agent test email",
        text:
          "This is a test email from Sales Agent.\n\n" +
          `It was sent through ${connection.smtpHost} from ${connection.email}, so your mailbox is ready to send.\n`,
      });
    } finally {
      transport.close();
    }
    await recordMailboxCheck(user.id, mailboxId, null);
    await logEvent(user.id, "mailbox.test_email_sent", { mailbox_id: mailboxId });
    revalidatePath(PATH);
    return { ok: true, message: `Test email sent to ${user.email}. Check your inbox (and spam folder).` };
  } catch (e) {
    const message = /decrypt|ENCRYPTION_KEY|SUPABASE_SERVICE_ROLE_KEY|Could not load mailbox/.test(String(e)) ? serverProblem(e) : describeMailError(e, "SMTP");
    await recordMailboxCheck(user.id, mailboxId, message).catch(() => {});
    revalidatePath(PATH);
    return { ok: false, message };
  }
}

export async function setDailyCap(mailboxId: string, cap: number): Promise<ActionResult> {
  const parsedCap = dailyCapSchema.safeParse(cap);
  if (!uuid.safeParse(mailboxId).success || !parsedCap.success) {
    return { ok: false, message: "The daily cap must be between 1 and 50." };
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.from("mailboxes").update({ daily_cap: parsedCap.data }).eq("id", mailboxId);
  if (error) return { ok: false, message: "Could not update the daily cap." };
  revalidatePath(PATH);
  return { ok: true, message: `Daily cap set to ${parsedCap.data}.` };
}

export async function setMailboxPaused(mailboxId: string, paused: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(mailboxId).success) return { ok: false, message: "Unknown mailbox." };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("mailboxes")
    .update(paused ? { status: "paused", status_reason: "Paused by you." } : { status: "active", status_reason: null })
    .eq("id", mailboxId);
  if (error) return { ok: false, message: "Could not update the mailbox." };
  await logEvent(user.id, paused ? "mailbox.paused" : "mailbox.resumed", { mailbox_id: mailboxId, by: "user" });
  revalidatePath(PATH);
  return { ok: true, message: paused ? "Mailbox paused." : "Mailbox active." };
}

export async function deleteMailbox(mailboxId: string): Promise<ActionResult> {
  if (!uuid.safeParse(mailboxId).success) return { ok: false, message: "Unknown mailbox." };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("mailboxes").delete().eq("id", mailboxId);
  if (error) return { ok: false, message: "Could not remove the mailbox." };
  await logEvent(user.id, "mailbox.removed", { mailbox_id: mailboxId });
  revalidatePath(PATH);
  return { ok: true, message: "Mailbox removed." };
}

/** Server configuration problems, named without exposing values. */
function serverProblem(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/SUPABASE_SERVICE_ROLE_KEY/.test(msg)) return "Server setup: SUPABASE_SERVICE_ROLE_KEY is missing.";
  if (/ENCRYPTION_KEY/.test(msg)) return "Server setup: ENCRYPTION_KEY is missing or invalid.";
  if (/decrypt/.test(msg)) return "Could not decrypt this mailbox's password (was ENCRYPTION_KEY changed?). Remove and reconnect it.";
  if (/Could not load mailbox/.test(msg)) return "Could not load the mailbox. Check that SUPABASE_SERVICE_ROLE_KEY is the secret key.";
  return "Something went wrong. Please try again.";
}
