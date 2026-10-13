import "server-only";

import { summarizeResearch } from "@/lib/ai";
import { logEvent } from "@/lib/events";
import { demoResearch } from "@/lib/leads/demo";
import { fetchPage, findAboutUrl } from "@/lib/research/fetch-site";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Prospect } from "@/lib/types";

const REUSE_DAYS = 30;

export type ResearchOutcome = { notes: string | null; detail: string | null; sourceUrl: string | null; thin: boolean };

/** Format sourced facts as the research_notes text (one fact per line, each with its source). */
export function formatNotes(facts: { fact: string; source_url: string }[]): string | null {
  if (!facts.length) return null;
  return facts.map((f) => `- ${f.fact.trim()} (source: ${f.source_url})`).join("\n");
}

/**
 * Research one prospect's company from its website (homepage + about page) and save short,
 * sourced research_notes plus one specific detail. Never invents anything: if the site can't be
 * read or says nothing specific, the notes stay empty and the writer falls back to a generic email.
 */
export async function researchProspect(prospect: Prospect): Promise<ResearchOutcome> {
  const db = createAdminClient();
  let outcome: ResearchOutcome;

  if (prospect.is_demo) {
    const demo = demoResearch(prospect.company);
    outcome = { notes: demo.notes, detail: demo.detail, sourceUrl: demo.sourceUrl, thin: false };
  } else if (!prospect.domain) {
    outcome = { notes: null, detail: null, sourceUrl: null, thin: true };
  } else {
    // Reuse recent research on the same company (same owner) instead of fetching again.
    const since = new Date(Date.now() - REUSE_DAYS * 86_400_000).toISOString();
    const { data: prior } = await db
      .from("prospects")
      .select("research_notes, personal_detail, research_source_url")
      .eq("user_id", prospect.user_id)
      .eq("domain", prospect.domain)
      .not("researched_at", "is", null)
      .gte("researched_at", since)
      .neq("id", prospect.id)
      .limit(1)
      .maybeSingle();

    if (prior) {
      outcome = { notes: prior.research_notes, detail: prior.personal_detail, sourceUrl: prior.research_source_url, thin: !prior.research_notes };
    } else {
      const home = await fetchPage(`https://${prospect.domain}/`);
      const pages: { url: string; text: string }[] = [];
      if (home?.text) pages.push({ url: home.url, text: home.text });
      const aboutUrl = home ? findAboutUrl(home.html, home.url) : null;
      if (aboutUrl) {
        const about = await fetchPage(aboutUrl);
        if (about?.text) pages.push({ url: about.url, text: about.text });
      }

      if (pages.length === 0 || pages.every((p) => p.text.length < 200)) {
        outcome = { notes: null, detail: null, sourceUrl: home?.url ?? null, thin: true };
      } else {
        const r = await summarizeResearch({ company: prospect.company, domain: prospect.domain, pages });
        const notes = formatNotes(r.facts);
        outcome = {
          notes,
          detail: r.personal_detail,
          sourceUrl: r.personal_detail_source_url ?? r.facts[0]?.source_url ?? pages[0].url,
          thin: !notes,
        };
      }
    }
  }

  await db
    .from("prospects")
    .update({
      research_notes: outcome.notes,
      personal_detail: outcome.detail,
      research_source_url: outcome.sourceUrl,
      researched_at: new Date().toISOString(),
    })
    .eq("id", prospect.id)
    .eq("user_id", prospect.user_id);

  await logEvent(prospect.user_id, "researcher.done", {
    prospect_id: prospect.id,
    thin: outcome.thin,
    has_detail: Boolean(outcome.detail),
  });
  return outcome;
}
