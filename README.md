# Sales_Agent

AI agents that turn a description of your business into a target customer profile, find and research
matching prospects, write short honest emails, and send them from your own mailbox within safe limits.

1. **Planner**: your description → an editable target customer profile + search plan
2. **Finder**: matching people via Apollo (or clearly labelled demo data without a key)
3. **Verifier**: syntax + MX check; only "valid" addresses are ever emailed
4. **Researcher**: reads the company's homepage + about page; saves short, sourced notes and one true detail
5. **Writer**: a first email + 2 follow-ups, under 120 words, plain text, only facts from the research (fact-checked)
6. **Sender**: your own mailbox over SMTP, inside each recipient's business hours, with daily caps
7. **Replies**: reads your inbox over IMAP, stops the sequence on any reply, sorts it, drafts answers with your Calendly link
8. **Dashboard**: stats, mailbox health, the audit log, and a "Pause all sending" switch

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + RLS) · Anthropic Claude ·
nodemailer / imapflow · Vercel Cron.

## Safety rules (enforced in code, unit-tested)

Sending is automatic, so these are checked by the sender right before **every** email
(`src/lib/sending/rules.ts`, tests in `src/lib/sending/*.test.ts`):

- Only addresses verified **valid**; never role addresses (info@, support@, sales@, …); never demo data
- Do-not-contact list checked before each send; the same person is never active in two campaigns
- Per-mailbox daily cap (default 30, max 50, also enforced by the database)
- Random times inside the recipient's business hours (Mon–Fri 9–17 local); ≥ 3 business days between steps
- Any reply stops the sequence (out-of-office pauses and resumes after the return date, or 7 business days)
- Plain text, no tracking, under 120 words; every email has a one-click unsubscribe link (+ RFC 8058 headers)
  and your physical mailing address; unsubscribes are suppressed immediately
- Global "Pause all sending" switch, plus a server-wide `SENDING_DISABLED` kill switch
- A mailbox with > 5% bounces in a day is paused automatically, with the reason shown

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the values (never commit them)
npm run dev                  # http://localhost:3000
```

Checks: `npm run lint` · `npm run typecheck` · `npm run build` · `npm test` (unit tests) ·
`npm run test:db` (applies the SQL migrations to an in-memory Postgres and checks the RLS rules).

Background jobs locally (they only run when called):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/agents   # verify → research → write → schedule
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/send     # send due emails
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/replies  # read replies + bounces
```

## Setup

### 1. Supabase

1. Create a project. Copy the values listed in `.env.example` (Project Settings → API) into `.env.local`.
   `SUPABASE_SERVICE_ROLE_KEY` must be the **secret** key (`sb_secret_…` or the legacy `service_role` JWT), not the publishable one.
2. SQL Editor → paste and run every file in `supabase/migrations/` in order.
3. Authentication → URL Configuration: Site URL = your app URL; add `http://localhost:3000/auth/callback`
   and `https://<your-domain>/auth/callback` to Redirect URLs.
4. Optional: Authentication → Providers → Google (needs a Google Cloud OAuth client). Magic links work without it.

### 2. Keys

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` (encrypts mailbox passwords, signs unsubscribe links; don't change it later) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `APP_URL` | your public URL, e.g. `https://sales-agent.vercel.app` (used in unsubscribe links) |
| `APOLLO_API_KEY` | optional: Apollo → Settings → API Keys (**master** key). Without it, demo data is used |
| `SENDING_DISABLED` | optional: `true` stops all sending immediately |

### 3. Deploy on Vercel

1. Import the GitHub repo in Vercel (framework: Next.js; defaults are fine).
2. Project → Settings → Environment Variables: add every variable above for **Production** (and Preview if you use it).
3. Deploy. `vercel.json` registers three cron jobs (they run on the production deployment only):
   `/api/cron/send` every 5 min, `/api/cron/replies` and `/api/cron/agents` every 10 min.
4. Add the production `/auth/callback` URL in Supabase (step 1.3).

**Plan limits:** cron jobs more frequent than once a day need a paid Vercel plan (Pro). On Hobby, crons run at
most once per day, which is far too slow for sending and reply handling, and a deploy with these schedules may be
rejected. On Hobby, remove the `crons` block from `vercel.json` and turn on the included GitHub Actions scheduler
(`.github/workflows/background-jobs.yml`, instructions at the top of the file). Each job is time-boxed to fit a
60-second function.

### 4. In the app

1. Sign up → fill in your business profile (the mailing address is required for the email footer).
2. Mailboxes → connect your mailbox with an app password → "Send me a test email".
3. Campaigns → New campaign → describe who you want to reach → review/edit the profile → Approve.
4. Research & write → review the emails on each prospect → Start sending.
5. Watch the Overview and Inbox. Use "Pause all sending" any time.

See `TODO.md` for known gaps and what hasn't been tested end to end yet.
