import { runAgents } from "@/lib/agents/run-all";
import { isAuthorizedCron, runJob, unauthorized } from "@/lib/cron";

/** Verify, research and write for new prospects of running campaigns; start ready sequences. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return unauthorized();
  return runJob("agents", () => runAgents({ budgetMs: 45_000 }));
}
