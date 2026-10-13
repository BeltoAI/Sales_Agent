import "server-only";

import { simpleParser } from "mailparser";
import { logEvent } from "@/lib/events";
import { createImapClient, describeMailError } from "@/lib/mail/connection";
import { loadMailboxConnection } from "@/lib/mail/mailbox-store";
import { assertPublicHost } from "@/lib/net/public-host";
import { createAdminClient } from "@/lib/supabase/admin";
import { toIncoming } from "./mime";
import { classifyPending, handleIncoming } from "./process";

const MAX_PER_MAILBOX = 25;
const MAX_SOURCE_BYTES = 256 * 1024;

export type ReplyRunResult = { mailboxes: number; read: number; replies: number; bounces: number; errors: number; reclassified: number };

/**
 * Read new mail from every connected mailbox over IMAP (read-only: nothing is marked as read or
 * moved), record replies and bounces, and stop sequences. The per-mailbox UID bookmark is saved
 * after each message, so the job is idempotent and resumes where it stopped.
 */
export async function runReplyJob({ budgetMs = 45_000 }: { budgetMs?: number } = {}): Promise<ReplyRunResult> {
  const started = Date.now();
  const db = createAdminClient();
  const result: ReplyRunResult = { mailboxes: 0, read: 0, replies: 0, bounces: 0, errors: 0, reclassified: 0 };

  // Paused/errored mailboxes still need replies read (pausing stops sending, not listening).
  const { data: mailboxes } = await db
    .from("mailboxes")
    .select("id, user_id, created_at, imap_uidvalidity, last_seen_uid")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(20);

  for (const mb of mailboxes ?? []) {
    if (Date.now() - started > budgetMs - 10_000) break;
    result.mailboxes++;
    let client: ReturnType<typeof createImapClient> | null = null;
    try {
      const loaded = await loadMailboxConnection(mb.user_id, mb.id);
      if (!loaded) continue;
      await assertPublicHost(loaded.connection.imapHost);
      client = createImapClient(loaded.connection);
      client.on("error", () => {});
      await client.connect();
      const lock = await client.getMailboxLock("INBOX", { readOnly: true });
      try {
        const box = client.mailbox;
        if (!box) throw new Error("INBOX not available");
        const uidValidity = Number(box.uidValidity);
        const sameFolder = mb.imap_uidvalidity !== null && Number(mb.imap_uidvalidity) === uidValidity && mb.last_seen_uid !== null;

        let uids: number[];
        if (sameFolder) {
          const found = await client.search({ uid: `${Number(mb.last_seen_uid) + 1}:*` }, { uid: true });
          uids = (found || []).filter((u) => u > Number(mb.last_seen_uid));
        } else {
          // First run (or the folder was rebuilt): look at mail since the mailbox was connected.
          const since = new Date(new Date(mb.created_at).getTime() - 86_400_000);
          uids = (await client.search({ since }, { uid: true })) || [];
        }
        uids.sort((a, b) => a - b);

        let lastUid = sameFolder ? Number(mb.last_seen_uid) : 0;
        for (const uid of uids.slice(0, MAX_PER_MAILBOX)) {
          if (Date.now() - started > budgetMs - 5_000) break;
          const msg = await client.fetchOne(String(uid), { uid: true, internalDate: true, source: { maxLength: MAX_SOURCE_BYTES } }, { uid: true });
          if (msg && msg.source) {
            const parsed = await simpleParser(msg.source, { skipHtmlToText: false, skipTextLinks: true, skipImageLinks: true });
            const when = parsed.date ?? (msg.internalDate ? new Date(msg.internalDate) : new Date());
            const outcome = await handleIncoming(mb.user_id, mb.id, toIncoming(parsed), when);
            if (outcome === "reply") result.replies++;
            if (outcome === "bounce") result.bounces++;
            result.read++;
          }
          lastUid = Math.max(lastUid, uid);
          // Save the bookmark after every message so a timeout never reprocesses or skips mail.
          await db.from("mailboxes").update({ imap_uidvalidity: uidValidity, last_seen_uid: lastUid }).eq("id", mb.id).eq("user_id", mb.user_id);
        }
        if (!uids.length) {
          const bookmark = sameFolder ? Number(mb.last_seen_uid) : Math.max(Number(box.uidNext) - 1, 0);
          await db.from("mailboxes").update({ imap_uidvalidity: uidValidity, last_seen_uid: bookmark }).eq("id", mb.id).eq("user_id", mb.user_id);
        }
      } finally {
        lock.release();
      }
      await db.from("mailboxes").update({ last_checked_at: new Date().toISOString() }).eq("id", mb.id).eq("user_id", mb.user_id);
    } catch (e) {
      result.errors++;
      const message = describeMailError(e, "IMAP");
      await db.from("mailboxes").update({ last_checked_at: new Date().toISOString(), last_error: message }).eq("id", mb.id).eq("user_id", mb.user_id);
      await logEvent(mb.user_id, "replies.read_failed", { mailbox_id: mb.id, error: message });
    } finally {
      if (client) await client.logout().catch(() => client?.close());
    }
  }

  const left = budgetMs - (Date.now() - started);
  if (left > 8_000) result.reclassified = await classifyPending(10, left - 5_000);
  return result;
}
