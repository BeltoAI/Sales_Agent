import { isAuthorizedCron, runJob, unauthorized } from "@/lib/cron";
import { runReplyJob } from "@/lib/replies/reader";

/** Read new mail over IMAP, record replies/bounces, stop sequences, classify replies. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return unauthorized();
  return runJob("replies", () => runReplyJob({ budgetMs: 50_000 }));
}
