# Sales_Agent
# Sales_Agent

AI agents that turn a description of your business into a target customer profile, find and research matching prospects, write short honest emails, and send them from your own mailbox within safe limits.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Checks: `npm run lint`, `npm run typecheck`, `npm run build`.

Environment variables are listed in `.env.example`. Copy it to `.env.local` and fill in values; never commit real values.

## Supabase setup

1. Create a Supabase project. Copy the values listed in `.env.example` (Project Settings → API) into `.env.local`.
2. Open the SQL Editor, paste `supabase/migrations/0001_init.sql`, and run it once.
3. Authentication → URL Configuration: set Site URL to `http://localhost:3000` (your Vercel URL in production) and add `http://localhost:3000/auth/callback` (and `https://<your-vercel-domain>/auth/callback`) to Redirect URLs.
4. Optional: Authentication → Providers → Google, to enable "Continue with Google". Magic links work without it.

`npm run test:db` applies the migrations to an in-memory Postgres and checks the Row Level Security rules (no Supabase account needed).
