import "server-only";

import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

/** Everything needed to talk to a mailbox. The password only ever lives in memory. */
export type MailboxConnection = {
  email: string;
  username: string;
  password: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
};

const TIMEOUTS = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 };

export function createSmtpTransport(c: MailboxConnection) {
  return nodemailer.createTransport({
    host: c.smtpHost,
    port: c.smtpPort,
    secure: c.smtpPort === 465, // implicit TLS
    requireTLS: c.smtpPort === 587, // STARTTLS required, never plain text
    auth: { user: c.username, pass: c.password },
    tls: { minVersion: "TLSv1.2", servername: c.smtpHost },
    logger: false,
    debug: false,
    ...TIMEOUTS,
  });
}

export function createImapClient(c: MailboxConnection) {
  return new ImapFlow({
    host: c.imapHost,
    port: c.imapPort,
    secure: true,
    auth: { user: c.username, pass: c.password },
    logger: false, // imapflow logs protocol traffic by default; never let credentials reach logs
    emitLogs: false,
    tls: { minVersion: "TLSv1.2" },
    ...TIMEOUTS,
  });
}

export async function testSmtp(c: MailboxConnection): Promise<void> {
  const transport = createSmtpTransport(c);
  try {
    await transport.verify();
  } finally {
    transport.close();
  }
}

export async function testImap(c: MailboxConnection): Promise<void> {
  const client = createImapClient(c);
  // Swallow late socket errors so they can't crash the process after we've finished.
  client.on("error", () => {});
  try {
    await client.connect();
    await client.status("INBOX", { messages: true });
  } finally {
    await client.logout().catch(() => client.close());
  }
}

/**
 * Turn connection errors into plain advice. Never echoes server responses verbatim,
 * since some servers include the username in auth errors.
 */
export function describeMailError(err: unknown, protocol: "SMTP" | "IMAP"): string {
  const e = err as { code?: string; responseCode?: number; authenticationFailed?: boolean; message?: string };
  const msg = e?.message ?? "";
  if (e?.code === "EAUTH" || e?.authenticationFailed || e?.responseCode === 535 || /auth/i.test(msg)) {
    return `${protocol}: the username or password was rejected. Gmail, Outlook and most providers need an app password, not your normal password.`;
  }
  if (e?.code === "ENOTFOUND" || e?.code === "EDNS" || /Could not find the server/.test(msg)) {
    return `${protocol}: server not found. Check the server name.`;
  }
  if (e?.code === "ETIMEDOUT" || e?.code === "ECONNECTION" || e?.code === "ECONNREFUSED" || /timeout/i.test(msg)) {
    return `${protocol}: could not connect (timed out or refused). Check the server name and port.`;
  }
  if (/not a public internet host/.test(msg)) return `${protocol}: ${msg}`;
  if (/certificate|ssl|tls/i.test(msg)) return `${protocol}: secure connection failed (TLS). Check the server name and port.`;
  return `${protocol}: connection failed. Check the settings and try again.`;
}
