import { Card, CardBody, LinkButton, Nav } from "@/ui";

export default function LandingPage() {
  return (
    <>
      <Nav
        actions={
          <LinkButton href="/login" variant="ghost" size="sm">
            Log in
          </LinkButton>
        }
      />
      <main className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(ellipse_at_top,rgba(45,212,191,0.16),transparent_60%)]"
        />
        <section className="relative mx-auto flex max-w-[1180px] flex-col items-center px-5 pt-28 pb-20 text-center sm:pt-36">
          <p className="rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-xs font-semibold tracking-[0.14em] text-accent uppercase">
            Outbound without the spam
          </p>
          <h1 className="mt-7 max-w-[12ch] text-[44px] leading-[0.96] font-semibold tracking-[-0.05em] text-balance sm:text-[92px]">
            Outreach that sounds like you wrote it.
          </h1>
          <p className="mt-7 max-w-[56ch] text-lg leading-relaxed text-pretty text-muted sm:text-[19px]">
            Tell Sales Agent what you sell and who you want to reach. It finds matching prospects, researches each one,
            writes a short personal email, and sends it from your own mailbox. The moment someone replies, the sequence
            stops.
          </p>
          <LinkButton href="/signup" size="lg" className="mt-10">
            Get started
          </LinkButton>
          <p className="mt-4 text-[13.5px] text-subtle">No card required. Your mailbox stays yours.</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-2">
            {["Finds prospects", "Researches each one", "Writes short emails", "Sends from your mailbox", "Stops on reply"].map(
              (label) => (
                <span
                  key={label}
                  className="rounded-full border border-border bg-surface px-3.5 py-2 text-[13.5px] text-muted"
                >
                  {label}
                </span>
              ),
            )}
          </div>
        </section>

        <section className="relative mx-auto max-w-[1120px] px-5 pb-24">
          <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_30px_90px_rgba(0,0,0,0.65),0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
              <span className="flex gap-1.5" aria-hidden>
                <span className="size-2.5 rounded-full bg-danger/70" />
                <span className="size-2.5 rounded-full bg-warning/70" />
                <span className="size-2.5 rounded-full bg-success/70" />
              </span>
              <span className="rounded-full border border-border bg-bg px-3 py-1 text-xs text-subtle">
                sales-agent.app/dashboard
              </span>
            </div>
            <div className="grid gap-0 sm:grid-cols-[1fr_1.4fr]">
              <div className="border-b border-border p-5 sm:border-r sm:border-b-0">
                <p className="text-xs font-medium tracking-wide text-subtle uppercase">Prospect</p>
                <p className="mt-3 text-base font-semibold text-fg">Maya Chen</p>
                <p className="mt-1 text-sm text-muted">Head of Ops · Northwind</p>
                <p className="mt-4 text-xs font-medium tracking-wide text-subtle uppercase">Why her</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Northwind just opened a second warehouse. Her team is hiring onboarding staff.
                </p>
              </div>
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-fg">Quick question about Northwind&apos;s onboarding</p>
                  <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                    Draft ready · Step 1 of 3
                  </span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted">
                  Hi Maya - saw Northwind just opened a second warehouse. Congrats. We help ops teams cut onboarding time
                  for new hires from weeks to days. Worth a 15-minute chat next week?
                </p>
                <p className="mt-4 text-sm text-fg">- Alex</p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-[1180px] px-5 pb-24">
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                title: "The right people",
                body: "You describe your ideal customer. Sales Agent builds the profile and finds people who actually match it, then skips duplicates, role inboxes, and anyone who already said no.",
              },
              {
                title: "Real research",
                body: "Every prospect gets read up on: their site, their role, what changed lately. Emails cite facts from their world, never invented details.",
              },
              {
                title: "Honest by default",
                body: "Short plain-text emails, no tracking pixels, a working unsubscribe link in every message, and a hard cap on sends. Replies stop the sequence before a human has to.",
              },
            ].map((feature) => (
              <Card key={feature.title}>
                <CardBody>
                  <h3 className="text-[22px] leading-[1.06] font-semibold tracking-[-0.032em] text-fg">{feature.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-muted">{feature.body}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        <footer className="relative border-t border-border px-5 py-10 text-center">
          <p className="text-sm text-subtle">Sales Agent - a Belto tool</p>
        </footer>
      </main>
    </>
  );
}
