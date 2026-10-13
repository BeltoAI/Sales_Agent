import { isAuthorizedCron, runJob, unauthorized } from "@/lib/cron";
import { runSendJob } from "@/lib/sending/sender";

/** Send due emails in a small batch, enforcing every safety rule right before each send. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return unauthorized();
  return runJob("send", () => runSendJob({ budgetMs: 45_000 }));
}
