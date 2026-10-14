import Link from "next/link";

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how" },
  { label: "Pricing", href: "#pricing" },
  { label: "Privacy", href: "#privacy" },
];

const voices = [
  {
    tag: "Investor · email",
    words: "Long form",
    body: "Hi Maya, I saw Northwind just opened a second warehouse. We help ops teams cut onboarding time for new hires from weeks to days. If outbound is on your roadmap this quarter, I would love to share how teams like yours run it. Open to a 15-minute intro next week? - Alex",
  },
  {
    tag: "Founder · email",
    words: "Short form",
    body: "Hi Maya, saw the second warehouse. We help ops teams cut onboarding time from weeks to days. Worth a 15-minute chat?",
  },
  {
    tag: "Quick intro · email",
    words: "One line",
    body: "Hi Maya, second warehouse? Let's talk onboarding.",
  },
];

const brainQuestions = [
  { tag: "Research", q: "What changed at Northwind lately?" },
  { tag: "Voice", q: "How do I usually open cold emails?" },
  { tag: "Memory", q: "Have we talked to anyone at Northwind?" },
  { tag: "Follow-ups", q: "Who has not replied yet?" },
  { tag: "Draft", q: "Write a follow-up for Maya." },
  { tag: "Safety", q: "Is this email safe to send?" },
  { tag: "Plan", q: "What should I send next?" },
];

const promises = [
  { n: "01", title: "Credentials sealed", body: "Your mailbox password is encrypted at rest. We never store it in plain text." },
  { n: "02", title: "Your mailbox stays yours", body: "We send from your mailbox, through your provider. Nothing is rerouted or relabeled." },
  { n: "03", title: "Never train or sell", body: "Your data is never used to train models and never sold to anyone." },
  { n: "04", title: "No lock-in", body: "Your prospects and drafts live in your account. Remove your mailbox any time." },
  { n: "05", title: "You decide what sends", body: "Nothing goes out without your approval. Ever." },
];

const stackItems = ["Gmail", "Outlook", "IMAP", "SMTP", "Apollo", "Claude", "Supabase", "Vercel"];

const plans = [
  {
    name: "Starter",
    price: "Free",
    note: "For your first campaign.",
    features: ["1 mailbox", "AI-drafted emails", "Prospect research", "Safety checks"],
    cta: "Start free",
    gradient: "from-teal-500 to-cyan-600",
  },
  {
    name: "Growth",
    price: "Free in beta",
    note: "For steady outbound.",
    features: ["Everything in Starter", "Multiple mailboxes", "Team seats", "Shared suppression"],
    cta: "Start free",
    gradient: "from-violet-500 to-fuchsia-600",
  },
  {
    name: "Custom",
    price: "Let's talk",
    note: "For agencies and high volume.",
    features: ["Everything in Growth", "Custom limits", "Dedicated support", "Onboarding help"],
    cta: "Get started",
    gradient: "from-blue-500 to-indigo-600",
  },
];

function Nav() {
  return (
    <header className="fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <nav className="flex w-full max-w-[1100px] items-center justify-between gap-4 rounded-full border border-white/10 bg-[#0c0c10]/80 px-4 py-2 shadow-lg backdrop-blur-xl">
        <Link href="#top" className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-teal-400 shadow-[0_0_12px_rgba(45,212,191,0.9)]" />
          <span className="text-[14.5px] font-semibold tracking-tight text-white">SalesAgent</span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3 py-1.5 text-[13.5px] text-zinc-400 hover:bg-white/5 hover:text-white">
              {l.label}
            </Link>
          ))}
        </div>
        <Link href="/signup" className="rounded-full border border-teal-400/40 bg-teal-400/15 px-3.5 py-1.5 text-[13.5px] font-semibold text-teal-300">
          Get started
        </Link>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0c0c10] px-5 py-8">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-4">
        <Link href="#top" className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-teal-400" />
          <span className="text-[14.5px] font-semibold text-white">SalesAgent</span>
        </Link>
        <div className="flex items-center gap-5 text-[13.5px] text-zinc-400">
          <Link href="#product" className="hover:text-white">Product</Link>
          <Link href="#pricing" className="hover:text-white">Pricing</Link>
          <Link href="#privacy" className="hover:text-white">Privacy</Link>
        </div>
        <p className="text-[13.5px] text-zinc-500">© 2026 Belto</p>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        <section id="top" className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0c0c10] px-5 pt-32 pb-20 text-center">
          <div aria-hidden className="pointer-events-none absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-teal-500/25 blur-[140px]" />
          <div aria-hidden className="pointer-events-none absolute -top-20 -right-32 h-[420px] w-[420px] rounded-full bg-blue-500/20 blur-[140px]" />
          <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/3 h-[420px] w-[420px] rounded-full bg-violet-500/15 blur-[160px]" />
          <p className="relative rounded-full border border-teal-400/30 bg-teal-400/10 px-3.5 py-1.5 text-xs font-semibold tracking-[0.14em] text-teal-300 uppercase">
            Outbound without the spam
          </p>
          <h1 className="relative mt-7 max-w-[15ch] text-[clamp(40px,8.4vw,104px)] leading-[0.94] font-semibold tracking-[-0.048em] text-balance text-[#F5F2ED]">
            Stop <span className="text-zinc-500 line-through decoration-teal-400">spamming</span> inboxes. Start real conversations.
          </h1>
          <p className="relative mt-7 max-w-[55ch] text-[17px] leading-relaxed text-pretty text-zinc-400 sm:text-[19px]">
            SalesAgent finds your best-fit prospects, researches each one, and drafts emails in your voice. You approve. It sends from your mailbox. It stops the moment someone replies.
          </p>
          <div className="relative mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup" className="rounded-full bg-teal-400 px-6 py-3 text-[15px] font-semibold text-[#06251f] shadow-[0_14px_34px_rgba(45,212,191,0.3)] hover:-translate-y-0.5">
              Get started
            </Link>
            <Link href="#product" className="text-[15px] font-medium text-zinc-300 hover:text-teal-300">
              See how it works →
            </Link>
          </div>
          <p className="relative mt-4 text-[13px] text-zinc-500">No card required. Your mailbox stays yours.</p>
          <p className="relative mt-16 text-[13px] text-zinc-500">Scroll ↓</p>
        </section>

        <section id="product" className="bg-[#FAF8F4] px-5 py-24 text-[#141414] sm:py-32">
          <div className="mx-auto max-w-[1100px]">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-teal-700 uppercase">Product</p>
            <h2 className="mt-4 max-w-[20ch] text-[clamp(32px,4.5vw,48px)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
              One filter. Three drafts.
            </h2>
            <p className="mt-4 max-w-[50ch] text-[16px] leading-relaxed text-[#5c5c5c]">
              Every inbox, one filter. Almost nothing survives. What is left is three drafts, ready for your approval.
            </p>
            <div className="mt-12 rounded-[20px] border border-black/10 bg-white/70 p-5 shadow-[0_34px_80px_rgba(0,0,0,0.08)] backdrop-blur sm:p-6">
              <div className="divide-y divide-black/5">
                {[
                  { initials: "MN", name: "Maya North", detail: "Head of Ops · Northwind", preview: "Second warehouse just opened.", pill: "Draft ready" },
                  { initials: "JK", name: "Jon Keller", detail: "Founder · Keller Logistics", preview: "Hiring three ops leads.", pill: "Drafting" },
                  { initials: "AS", name: "Ana Silva", detail: "VP Sales · Silva & Co", preview: "Opened a Berlin office.", pill: "Researched" },
                ].map((p) => (
                  <div key={p.name} className="flex items-center gap-4 py-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[13px] font-semibold text-teal-800">{p.initials}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{p.name}</p>
                      <p className="truncate text-[13px] text-[#666]">{p.detail} · {p.preview}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-teal-600/30 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">{p.pill}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <p className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-[14px] font-medium">All inboxes, one filter</p>
              <p className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-[14px] font-medium">Almost nothing survives</p>
              <p className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-[14px] font-medium">Three drafts, ready to approve</p>
            </div>
          </div>
        </section>

        <section id="how" className="bg-[#0c0c10] px-5 py-24 sm:py-32">
          <div className="mx-auto max-w-[1100px]">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-teal-300 uppercase">How it works</p>
            <h2 className="mt-4 max-w-[20ch] text-[clamp(32px,4.5vw,48px)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance text-white">
              Press a chip. Watch it rewrite.
            </h2>
            <p className="mt-4 max-w-[50ch] text-[16px] leading-relaxed text-zinc-400">
              Every draft adapts to the prospect. Shorter, warmer, or exactly as written. You pick.
            </p>
            <div className="mt-12 grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
                {[
                  { initials: "MN", name: "Maya North", time: "2m", snippet: "Second warehouse just opened.", active: true },
                  { initials: "JK", name: "Jon Keller", time: "18m", snippet: "Hiring three ops leads.", active: false },
                  { initials: "AS", name: "Ana Silva", time: "1h", snippet: "Opened a Berlin office.", active: false },
                ].map((c) => (
                  <div key={c.name} className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${c.active ? "bg-white/[0.07] ring-1 ring-teal-400/40" : ""}`}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-400/15 text-[12px] font-semibold text-teal-300">{c.initials}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-white">{c.name} <span className="font-normal text-zinc-500">· {c.time}</span></p>
                      <p className="truncate text-[13px] text-zinc-400">{c.snippet}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[15px] font-semibold text-white">Maya North</p>
                  <span className="rounded-full border border-teal-400/30 bg-teal-400/10 px-2.5 py-1 text-xs font-medium text-teal-300">Head of Ops · Northwind</span>
                </div>
                <p className="mt-5 text-[14px] leading-relaxed text-zinc-400">
                  Context: Northwind just opened a second warehouse. Maya leads ops.
                </p>
                <p className="mt-4 text-[15px] leading-relaxed text-zinc-100">
                  Hi Maya - saw Northwind just opened a second warehouse. Congrats. We help ops teams cut onboarding time for new hires from weeks to days. Worth a 15-minute chat next week? - Alex
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-teal-400/40 bg-teal-400/15 px-3 py-1.5 text-[13px] font-medium text-teal-300">Warmer</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[13px] text-zinc-300">Shorter</span>
                  <span className="ml-auto rounded-full bg-teal-400 px-4 py-2 text-[13.5px] font-semibold text-[#06251f]">Approve</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#FAF8F4] px-5 py-24 text-[#141414] sm:py-32">
          <div className="mx-auto max-w-[1100px]">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-teal-700 uppercase">Voice</p>
            <h2 className="mt-4 max-w-[20ch] text-[clamp(32px,4.5vw,48px)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
              One email. Three voices.
            </h2>
            <p className="mt-4 max-w-[50ch] text-[16px] leading-relaxed text-[#5c5c5c]">
              Same prospect, three registers. SalesAgent matches the tone to the person.
            </p>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {voices.map((v) => (
                <div key={v.tag} className="rounded-[20px] border border-black/10 bg-white/70 p-5 shadow-sm backdrop-blur">
                  <p className="text-[12px] font-semibold tracking-[0.1em] text-teal-700 uppercase">{v.tag}</p>
                  <p className="mt-1 text-[12px] text-[#888]">{v.words}</p>
                  <p className="mt-4 text-[15px] leading-relaxed">{v.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="brain" className="bg-[#0c0c10] px-5 py-24 sm:py-32">
          <div className="mx-auto max-w-[1100px]">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-teal-300 uppercase">Brain</p>
            <h2 className="mt-4 max-w-[20ch] text-[clamp(32px,4.5vw,48px)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance text-white">
              Ask anything. Watch it answer.
            </h2>
            <p className="mt-4 max-w-[50ch] text-[16px] leading-relaxed text-zinc-400">
              Every draft draws on research, memory, and your voice.
            </p>
            <div className="mt-12 grid gap-4 lg:grid-cols-[26fr_38fr_36fr]">
              <div className="flex flex-col gap-2">
                {brainQuestions.map((b, i) => (
                  <div key={b.q} className={`rounded-[18px] border p-3.5 ${i === 0 ? "border-teal-400/40 bg-white/[0.07]" : "border-white/10 bg-white/[0.04]"}`}>
                    <span className="inline-block rounded-full border border-teal-400/30 bg-teal-400/10 px-2 py-0.5 text-[11px] font-medium text-teal-300">{b.tag}</span>
                    <p className="mt-2 text-[13.5px] font-medium text-white">{b.q}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                <p className="text-[14px] font-medium text-white">What changed at Northwind lately?</p>
                <span className="mt-3 inline-block rounded-full border border-teal-400/30 bg-teal-400/10 px-2.5 py-1 text-xs font-medium text-teal-300">Answer ready</span>
                <p className="mt-4 text-[15px] leading-relaxed text-zinc-100">
                  Northwind opened a second warehouse last month and is hiring three ops leads. Maya North leads ops there.
                </p>
                <h3 className="mt-6 text-[18px] font-semibold text-white">It already knows the history</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-zinc-400">
                  Drafts draw on recent conversation, past style, and memory. No history gets pasted into prompts. The research stays yours.
                </p>
                <p className="mt-3 border-l-2 border-teal-400 pl-3 text-[14px] text-zinc-300 italic">
                  Hi Maya - saw the second warehouse...
                </p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                <p className="text-[12px] font-semibold tracking-[0.1em] text-teal-300 uppercase">Research · Northwind</p>
                <p className="mt-3 text-[15px] font-semibold text-white">What the answer used</p>
                <ul className="mt-4 space-y-3 text-[14px] leading-relaxed text-zinc-300">
                  <li>Three ops roles posted.</li>
                  <li>Maya North leads operations.</li>
                  <li>Second warehouse opened last month.</li>
                </ul>
                <div className="mt-5 rounded-2xl border border-white/10 bg-[#0c0c10]/60 p-4">
                  <p className="font-mono text-[12px] text-zinc-500">key fragment</p>
                  <p className="mt-1 font-mono text-[13px] text-teal-300">sk-••••••••••••4f2a</p>
                  <p className="mt-2 text-[12px] text-zinc-400">Your credentials stay sealed. Only you hold the key.</p>
                </div>
              </div>
            </div>
            <div className="mx-auto mt-12 max-w-[640px] text-center">
              <h3 className="text-[22px] font-semibold text-white">Nothing sends on one tap.</h3>
              <div className="mt-5 rounded-[20px] border border-white/10 bg-white/[0.04] p-5 text-left backdrop-blur">
                <p className="text-[14px] text-zinc-300">Detected: this draft asks Maya for a meeting next week.</p>
                <p className="mt-2 text-[14px] text-zinc-400">Review it, then hold to approve.</p>
                <div className="mt-4 flex justify-center">
                  <span className="rounded-full border-2 border-teal-400/60 px-8 py-3 text-[14px] font-semibold text-teal-300">Hold to approve</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden bg-[#0c0c10] px-5 py-16">
          <p className="text-center text-[12px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">Runs on your stack</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {stackItems.map((s) => (
              <span key={s} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[13.5px] text-zinc-300">{s}</span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {[...stackItems].reverse().map((s) => (
              <span key={s} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[13.5px] text-zinc-300">{s}</span>
            ))}
          </div>
        </section>

        <section id="pricing" className="bg-[#FAF8F4] px-5 py-24 text-[#141414] sm:py-32">
          <div className="mx-auto max-w-[1100px]">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-teal-700 uppercase">Pricing</p>
            <h2 className="mt-4 max-w-[20ch] text-[clamp(32px,4.5vw,48px)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
              Pick where to start.
            </h2>
            <p className="mt-4 max-w-[50ch] text-[16px] leading-relaxed text-[#5c5c5c]">
              Free while in beta. Paid pricing arrives at launch.
            </p>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {plans.map((p) => (
                <div key={p.name} className={`flex h-full flex-col rounded-[20px] bg-gradient-to-br ${p.gradient} p-6 text-white shadow-lg`}>
                  <p className="text-[12px] font-semibold tracking-[0.1em] uppercase opacity-80">{p.name}</p>
                  <p className="mt-3 text-[36px] leading-none font-semibold tracking-tight">{p.price}</p>
                  <p className="mt-2 text-[14px] opacity-80">{p.note}</p>
                  <ul className="mt-5 flex-1 space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2 text-[14px]"><span>✓</span>{f}</li>
                    ))}
                  </ul>
                  <Link href="/signup" className="mt-6 block rounded-full bg-white px-5 py-2.5 text-center text-[14px] font-semibold text-[#141414]">{p.cta}</Link>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-[14px] text-[#666]">Every plan is free during beta. No card required.</p>
          </div>
        </section>

        <section className="bg-[#0c0c10] px-5 py-24 sm:py-32">
          <div className="mx-auto grid max-w-[1100px] gap-10 lg:grid-cols-2">
            <div>
              <p className="text-[12px] font-semibold tracking-[0.14em] text-teal-300 uppercase">Get started</p>
              <h2 className="mt-4 max-w-[20ch] text-[clamp(32px,4.5vw,48px)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance text-white">
                Three steps. No setup calls.
              </h2>
              <p className="mt-4 max-w-[50ch] text-[16px] leading-relaxed text-zinc-400">
                Connect your mailbox, describe who you want to reach, approve drafts. That is the whole setup.
              </p>
            </div>
            <div className="space-y-4">
              {[
                { n: "1", title: "Connect your mailbox", body: "Add Gmail, Outlook, or any IMAP/SMTP mailbox." },
                { n: "2", title: "Set your ideal customer", body: "Describe who you want to reach. SalesAgent builds the profile and finds matches." },
                { n: "3", title: "Approve drafts", body: "Review each draft. Approve the ones you like. Nothing sends without you." },
              ].map((s) => (
                <div key={s.n} className="flex gap-4 rounded-[20px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-400/15 text-[14px] font-semibold text-teal-300">{s.n}</span>
                  <div>
                    <p className="text-[15px] font-semibold text-white">{s.title}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-zinc-400">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="privacy" className="bg-[#FAF8F4] px-5 py-24 text-[#141414] sm:py-32">
          <div className="mx-auto max-w-[1100px]">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-teal-700 uppercase">Privacy</p>
            <h2 className="mt-4 max-w-[20ch] text-[clamp(32px,4.5vw,48px)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
              Your keys and your control.
            </h2>
            <p className="mt-4 max-w-[50ch] text-[16px] leading-relaxed text-[#5c5c5c]">
              Every account gets its own key. Five promises.
            </p>
            <div className="mt-12 space-y-4">
              {promises.map((p) => (
                <div key={p.n} className="flex gap-5 rounded-[20px] border border-black/10 bg-white/70 p-5 backdrop-blur">
                  <span className="text-[28px] leading-none font-semibold text-teal-700">{p.n}</span>
                  <div>
                    <h3 className="text-[18px] font-semibold">{p.title}</h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-[#5c5c5c]">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#0c0c10] px-5 py-16">
          <div className="mx-auto max-w-[700px] text-center">
            <p className="text-[15px] leading-relaxed text-zinc-400">
              SalesAgent is built in the open by Belto. Tell us what you need and we will build it.
            </p>
          </div>
        </section>

        <section className="bg-[#0c0c10] px-5 pb-24">
          <div className="mx-auto max-w-[1100px] rounded-[24px] bg-gradient-to-r from-teal-500 via-violet-500 to-blue-600 p-[1px] shadow-[0_34px_80px_rgba(0,0,0,0.4)]">
            <div className="rounded-[23px] bg-[#101014] px-6 py-14 text-center sm:py-20">
              <h2 className="mx-auto max-w-[18ch] text-[clamp(32px,5vw,56px)] leading-[1.02] font-semibold tracking-[-0.03em] text-balance text-white">
                Outbound that still sounds like you.
              </h2>
              <div className="mt-8 flex justify-center">
                <Link href="/signup" className="rounded-full bg-teal-400 px-7 py-3.5 text-[15px] font-semibold text-[#06251f] shadow-[0_14px_34px_rgba(45,212,191,0.3)] hover:-translate-y-0.5">
                  Start free
                </Link>
              </div>
              <p className="mt-4 text-[13px] text-zinc-500">No card required.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {["Gmail", "Outlook", "Apollo", "Claude"].map((b) => (
                  <span key={b} className="rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[13px] text-zinc-300">{b}</span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
