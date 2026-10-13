import type { EventRow } from "@/lib/types";

/** Plain-language lines for the activity log. Unknown types fall back to the raw type name. */
export function describeEvent(e: Pick<EventRow, "type" | "payload">): string {
  const p = e.payload ?? {};
  const n = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : 0);
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
  switch (e.type) {
    case "campaign.created": return "Campaign created";
    case "campaign.started": return "Campaign started sending";
    case "campaign.paused": return "Campaign paused";
    case "campaign.deleted": return "Campaign deleted";
    case "planner.icp_created": return p.regenerated ? "Planner regenerated the target profile" : "Planner drafted the target profile";
    case "planner.icp_approved": return "Target profile approved";
    case "finder.run": return `Finder added ${n("added")} prospect${n("added") === 1 ? "" : "s"} (${s("provider")})`;
    case "verifier.rejected": return `Verifier rejected an address (${s("reason") || s("status")})`;
    case "researcher.done": return p.thin ? "Researcher found little on the website" : "Researcher saved notes";
    case "writer.done": return p.generic ? "Writer drafted a generic sequence" : "Writer drafted a personalised sequence";
    case "writer.failed": return "Writer couldn't produce emails that pass the checks";
    case "pipeline.error": return `Agent error: ${s("error")}`;
    case "scheduler.started": return `Scheduled ${n("started")} new sequence${n("started") === 1 ? "" : "s"}`;
    case "scheduler.skipped": return `Skipped a prospect (${s("reason")})`;
    case "message.sent": return `Sent email ${n("step")} of 3`;
    case "message.edited": return "You edited an email";
    case "send.cancelled": return `Send cancelled: ${s("reason")}`;
    case "send.failed": return `Send failed: ${s("reason")}`;
    case "send.error": return `Send error: ${s("error")}`;
    case "send.bounced": return "An email bounced; address suppressed";
    case "send.post_send_error": return "Email sent, but saving its status failed";
    case "reply.received": return "Reply received; sequence stopped";
    case "reply.classified": return `Reply sorted: ${s("category").replaceAll("_", " ")}`;
    case "reply.classify_failed": return "Couldn't sort a reply yet (will retry)";
    case "reply.answered": return "You answered a reply";
    case "replies.read_failed": return `Couldn't read the mailbox: ${s("error")}`;
    case "sequence.paused_ooo": return "Out of office: sequence paused";
    case "sequence.resumed": return `Sequence resumed at email ${n("step")}`;
    case "suppression.unsubscribed": return `Someone unsubscribed (${s("source")})`;
    case "mailbox.connected": return `Mailbox connected: ${s("email")}`;
    case "mailbox.removed": return "Mailbox removed";
    case "mailbox.paused": return "Mailbox paused";
    case "mailbox.resumed": return "Mailbox resumed";
    case "mailbox.auto_paused": return `Mailbox auto-paused: ${n("bounced")} of ${n("attempted")} bounced today`;
    case "mailbox.error": return "Mailbox failed to send; marked as error";
    case "mailbox.test_email_sent": return "Test email sent";
    case "sending.paused_all": return "You paused all sending";
    case "sending.resumed_all": return "You resumed sending";
    default: return e.type;
  }
}

export function isProblem(type: string): boolean {
  return /failed|error|bounced|auto_paused|rejected/.test(type);
}
