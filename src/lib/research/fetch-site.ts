import "server-only";

import { assertPublicHost } from "@/lib/net/public-host";

/**
 * Fetch a company web page as plain text, safely:
 *  - http(s) only, public hosts only (checked again on every redirect hop), max 3 redirects
 *  - 8 s timeout, 1 MB download cap, HTML/plain text only
 *  - scripts, styles and markup stripped; nothing is executed
 */

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;
const MAX_TEXT = 20_000;
const USER_AGENT = "Mozilla/5.0 (compatible; SalesAgentResearch/1.0; +https://github.com/BeltoAI/Sales_Agent)";

export type FetchedPage = { url: string; html: string; text: string };

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

export async function fetchPage(rawUrl: string): Promise<FetchedPage | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const deadline = AbortSignal.timeout(TIMEOUT_MS);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.port && url.port !== "80" && url.port !== "443") return null;
    try {
      await assertPublicHost(url.hostname);
    } catch {
      return null;
    }

    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: deadline,
        cache: "no-store",
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain;q=0.9" },
      });
    } catch {
      return null;
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location) return null;
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      return null;
    }
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) {
      await res.body?.cancel();
      return null;
    }
    const html = await readCapped(res);
    return { url: url.toString(), html, text: htmlToText(html).slice(0, MAX_TEXT) };
  }
  return null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…" };

/** Very small HTML → text conversion: good enough for the model, never executes anything. */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : " ";
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t\f\v\r]+/g, " ")
    .replace(/\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Find an "about"-style page linked from the homepage, on the same site. */
export function findAboutUrl(html: string, base: string): string | null {
  const baseUrl = new URL(base);
  const root = baseUrl.hostname.replace(/^www\./, "");
  const candidates: { url: string; score: number }[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u: URL;
    try {
      u = new URL(m[1], baseUrl);
    } catch {
      continue;
    }
    if (u.hostname.replace(/^www\./, "") !== root) continue;
    const hay = `${u.pathname} ${htmlToText(m[2])}`.toLowerCase();
    const score = /about|über|a-propos|quienes|who-we-are|our-story|company/.test(hay) ? (/about/.test(hay) ? 2 : 1) : 0;
    if (score && u.pathname !== "/" && u.pathname !== baseUrl.pathname) candidates.push({ url: u.toString().split("#")[0], score });
  }
  candidates.sort((a, b) => b.score - a.score || a.url.length - b.url.length);
  return candidates[0]?.url ?? null;
}
