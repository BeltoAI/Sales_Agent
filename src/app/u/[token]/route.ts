import { unsubscribe } from "@/lib/sending/stop";
import { verifyUnsubscribeToken } from "@/lib/sending/unsubscribe-token";

/**
 * Public one-click unsubscribe. No login.
 *  GET  — the link in the email footer: unsubscribes immediately and shows a confirmation.
 *  POST — RFC 8058 one-click (Gmail/Yahoo "Unsubscribe" button via List-Unsubscribe-Post).
 * Both are idempotent.
 */

export const dynamic = "force-dynamic";

function page(title: string, message: string, status = 200) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0c0c10;color:#f5f2ed;font:16px/1.5 "Schibsted Grotesk",system-ui,sans-serif}
main{max-width:28rem;padding:2.5rem 2rem;text-align:center;background:#1b1b22;border:1px solid rgba(255,255,255,0.08);border-radius:24px;box-shadow:0 30px 90px rgba(0,0,0,0.65),0 10px 30px rgba(0,0,0,0.5)}h1{font-size:1.5rem;margin:0 0 .5rem;letter-spacing:-0.02em}p{color:#d8d2cb;margin:0}.dot{display:inline-block;width:10px;height:10px;border-radius:9999px;background:#2dd4bf;margin-bottom:1rem}</style></head>
<body><main><span class="dot"></span><h1>${title}</h1><p>${message}</p></main></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

async function handle(token: string) {
  const data = verifyUnsubscribeToken(token);
  if (!data) return null;
  await unsubscribe(data.userId, data.email, "link");
  return data;
}

export async function GET(_req: Request, { params }: RouteContext<"/u/[token]">) {
  const { token } = await params;
  try {
    const data = await handle(token);
    if (!data) return page("Link not valid", "This unsubscribe link is invalid. Reply to the email and ask to be removed.", 400);
    return page("You're unsubscribed", "You won't receive any more emails from this sender.");
  } catch {
    return page("Something went wrong", "We couldn't process this right now. Please try again, or reply to the email and ask to be removed.", 500);
  }
}

export async function POST(_req: Request, { params }: RouteContext<"/u/[token]">) {
  const { token } = await params;
  try {
    const data = await handle(token);
    return new Response(data ? "Unsubscribed" : "Invalid link", { status: data ? 200 : 400, headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response("Error", { status: 500 });
  }
}
