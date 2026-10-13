import "server-only";

import { decrypt } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAILBOX_PUBLIC_COLUMNS, type Mailbox } from "@/lib/types";
import type { MailboxConnection } from "./connection";

/** Additional authenticated data for credential encryption: ties the ciphertext to its owner. */
export function credentialAad(userId: string): string {
  return `mailbox-credentials:${userId}`;
}

/**
 * Load a mailbox with decrypted credentials. Uses the service role (users can't read the
 * ciphertext column), so it ALWAYS filters by both id and the owner's user id.
 */
export async function loadMailboxConnection(
  userId: string,
  mailboxId: string,
): Promise<{ mailbox: Mailbox; connection: MailboxConnection } | null> {
  const { data, error } = await createAdminClient()
    .from("mailboxes")
    .select(`${MAILBOX_PUBLIC_COLUMNS}, encrypted_credentials`)
    .eq("id", mailboxId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Could not load mailbox (${error.code ?? "db error"}).`);
  if (!data) return null;

  const { encrypted_credentials, ...mailbox } = data as Mailbox & { encrypted_credentials: string };
  const password = decrypt(encrypted_credentials, credentialAad(userId));
  return {
    mailbox,
    connection: {
      email: mailbox.email,
      username: mailbox.username,
      password,
      smtpHost: mailbox.smtp_host,
      smtpPort: mailbox.smtp_port,
      imapHost: mailbox.imap_host,
      imapPort: mailbox.imap_port,
    },
  };
}

/** Record the result of a connection check (server-only columns). */
export async function recordMailboxCheck(userId: string, mailboxId: string, error: string | null) {
  await createAdminClient()
    .from("mailboxes")
    .update({ last_checked_at: new Date().toISOString(), last_error: error })
    .eq("id", mailboxId)
    .eq("user_id", userId);
}
