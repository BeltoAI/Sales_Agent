# TODO

Things that are not finished, not tested, or need action from the project owner.

## Magic link → "Something went wrong" (deferred)

**What happens:** after clicking the magic link, the browser shows the app's "Something went wrong" error page.

**What we know (from the dev-server log and a read-only API check, 2026-10-13):**
- The magic link itself works. The log shows `GET /auth/callback?code=… 307`: the code was exchanged
  for a session and the user was redirected to `/dashboard`.
- `/dashboard` then returned 500 with:
  `Error: Could not load profile: Could not find the table 'public.profiles' in the schema cache`
  (thrown in `src/lib/auth.ts` → `getProfile`, called from `src/app/dashboard/layout.tsx`).
- A direct request to `<SUPABASE_URL>/rest/v1/profiles` with the anon key returns HTTP 404, code `PGRST205`:
  the `profiles` table does not exist in the Supabase project. The migration has not been run yet
  (or was run in a different project).
- The "Something went wrong" text comes from `src/app/error.tsx` (the generic error boundary), not from the
  sign-in form.

**Likely fix:**
1. Supabase dashboard → SQL Editor → paste and run **all** files in `supabase/migrations/` in order
   (`0001_init.sql`, then the later ones).
2. If the tables exist but the error persists, run `notify pgrst, 'reload schema';` in the SQL Editor.
3. Make sure the project in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`) is the one where the SQL was run.

**Possible improvement:** show a friendlier "database not set up" message instead of the generic error page
when PostgREST returns `PGRST205`.

## Env / account issues found

- `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` currently holds the **same value as the anon/publishable key**.
  It must be the **secret** key (Project Settings → API Keys → `sb_secret_…`, or the legacy `service_role` JWT).
  Without it, every background job (finder, writer, verifier, sender, reply reader) fails.

## Phase 3 – Mailbox: not yet tested end to end

- Connecting a real mailbox, "Test connection" and "Send me a test email" have not been run against a real
  account (no test mailbox, migration not yet applied). The SMTP (465 + 587/STARTTLS) and IMAP (993) code
  was exercised against Gmail's real servers with fake credentials and correctly reports "password rejected".
- "Test connection" and "Send me a test email" on a saved mailbox need a working `SUPABASE_SERVICE_ROLE_KEY`
  (the encrypted password column is readable only by the server's service role).
- Editing a mailbox's server settings or password isn't supported; remove and reconnect instead.
- Microsoft 365 often blocks SMTP AUTH by default; the admin must enable "Authenticated SMTP" per mailbox.

## Phase 4 – Planner + Finder: not yet tested end to end

- `ANTHROPIC_API_KEY` is not in `.env.local`, so the planner (description → profile) has not made a live call.
  The structured-output schema was checked offline (converts and parses). Without the key, the campaign page
  says so and the profile can be filled in by hand and approved.
- The Apollo provider (`src/lib/leads/apollo.ts`) was written without a key and without access to Apollo's
  live docs (web access was unavailable). Assumptions to verify with a real **master** API key:
  `POST /api/v1/mixed_people/api_search` (header `x-api-key`, no emails returned) then
  `POST /api/v1/people/bulk_match` (10 ids per call, consumes credits) for work emails; field names
  `primary_domain`, `time_zone`, `email_not_unlocked…` placeholder. Industries are sent as `q_keywords`.
- The demo provider is used whenever `APOLLO_API_KEY` is empty; its people use `@example.com` and are blocked
  from sending by both the database and the sender.
- The finder runs inside the "Approve" / "Find more" button (25 prospects per click). No background finder yet.
