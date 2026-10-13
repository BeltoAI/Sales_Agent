import "server-only";

import { resumeOutOfOffice } from "@/lib/replies/process";
import { startReadyProspects } from "@/lib/sending/scheduler";
import { createAdminClient } from "@/lib/supabase/admin";
import { processNewProspects } from "./pipeline";

export type AgentsRunResult = { campaigns: number; written: number; invalid: number; started: number; resumed: number };

/**
 * Background agent pass over running campaigns: verify → research → write new prospects, then
 * start sequences for ready ones, and resume out-of-office pauses. Time-boxed; whatever doesn't fit continues on the next run.
 */
export async function runAgents({ budgetMs = 45_000 }: { budgetMs?: number } = {}): Promise<AgentsRunResult> {
  const started = Date.now();
  const db = createAdminClient();
  const result: AgentsRunResult = { campaigns: 0, written: 0, invalid: 0, started: 0, resumed: 0 };

  // Out-of-office pauses whose return date has passed.
  result.resumed = await resumeOutOfOffice();

  const { data: campaigns } = await db
    .from("campaigns")
    .select("id, user_id")
    .eq("status", "running")
    .order("updated_at", { ascending: true })
    .limit(20);

  for (const c of campaigns ?? []) {
    const left = budgetMs - (Date.now() - started);
    if (left < 5_000) break;
    result.campaigns++;
    try {
      const p = await processNewProspects(c.user_id, c.id, { budgetMs: Math.min(left - 3_000, 25_000), max: 3 });
      result.written += p.written;
      result.invalid += p.invalid;
    } catch {
      // One campaign's failure (e.g. missing AI key) must not stop the others; the pipeline logs it.
    }
    const s = await startReadyProspects(c.user_id, c.id);
    result.started += s.started;
  }
  return result;
}
