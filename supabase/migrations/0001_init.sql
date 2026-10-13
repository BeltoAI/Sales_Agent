-- =====================================================================================
-- Sales Agent: initial schema
-- Run once in the Supabase dashboard → SQL Editor. Safe to read top to bottom.
--
-- Security model (applies to every table):
--   * Row Level Security is ON for every table. A logged-in user can only ever see rows
--     where user_id = their own id.
--   * The browser ("anon" and "authenticated" roles) gets the minimum table privileges the
--     UI needs. Columns that safety rules depend on (email verification status, send status,
--     sent_at, bounce data, suppression removal, the audit log) can ONLY be written by the
--     server's service role, so nobody can bypass the safety rules by calling the API directly.
--   * Child rows reference parents with composite (id, user_id) foreign keys, so a row can
--     never point at another user's campaign / prospect / mailbox.
--
-- Lines marked "CHANGE:" are additions to the original data model, with the reason.
-- =====================================================================================


-- ---------- helpers -------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ---------- profiles ------------------------------------------------------------------

create table public.profiles (
  user_id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  company_name     text not null check (length(company_name) between 1 and 200),
  website          text check (website is null or website ~* '^https?://'),
  what_they_sell   text not null check (length(what_they_sell) between 1 and 2000),
  sender_name      text not null check (length(sender_name) between 1 and 120),
  -- Required in every email footer (CAN-SPAM). Sending is blocked without it.
  mailing_address  text not null check (length(mailing_address) between 5 and 500),
  calendly_url     text check (calendly_url is null or calendly_url ~* '^https://'),
  timezone         text not null default 'UTC',
  -- CHANGE: the dashboard's global "Pause all sending" switch. Checked before every send.
  sending_paused   boolean not null default false,
  -- CHANGE: set when onboarding is complete; protected pages send users to /onboarding until then.
  onboarded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();


-- ---------- mailboxes -----------------------------------------------------------------

create table public.mailboxes (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email                  text not null check (email = lower(email) and email like '%_@_%'),
  smtp_host              text not null,
  -- Vercel blocks outbound port 25, so only the submission ports are allowed.
  smtp_port              integer not null check (smtp_port in (465, 587)),
  imap_host              text not null,
  imap_port              integer not null default 993 check (imap_port = 993),
  username               text not null,
  -- AES-256-GCM ciphertext of the mailbox password, format "v1:<iv>:<tag>:<data>" (base64).
  -- The browser can never read this column (see grants below).
  encrypted_credentials  text not null check (encrypted_credentials like 'v1:%'),
  -- CHANGE: hard maximum of 50 enforced by the database, not just the UI.
  daily_cap              integer not null default 30 check (daily_cap between 1 and 50),
  status                 text not null default 'active' check (status in ('active', 'paused', 'error')),
  -- CHANGE: why the mailbox is paused or failing (e.g. "Paused: 2 of 25 sent today bounced (8%)").
  status_reason          text,
  -- CHANGE: last connection error, shown on the dashboard instead of failing silently.
  last_error             text,
  last_checked_at        timestamptz,
  -- CHANGE: IMAP bookmark so each reply check only reads new mail. A UID is only meaningful
  -- together with the folder's UIDVALIDITY; if that changes the bookmark is reset.
  imap_uidvalidity       bigint,
  last_seen_uid          bigint,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (id, user_id)
);

create unique index mailboxes_user_email_key on public.mailboxes (user_id, email);

create trigger mailboxes_updated_at before update on public.mailboxes
  for each row execute function public.set_updated_at();


-- ---------- campaigns -----------------------------------------------------------------

create table public.campaigns (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- CHANGE: which connected mailbox this campaign sends from.
  mailbox_id         uuid,
  name               text not null check (length(name) between 1 and 200),
  description        text not null default '' check (length(description) <= 5000),
  icp_json           jsonb,
  -- CHANGE: step 1 also produces a search plan (the actual provider queries); stored next to the ICP.
  search_plan_json   jsonb,
  -- CHANGE: when the user approved the (possibly edited) ICP. The Finder only runs after approval.
  icp_approved_at    timestamptz,
  status             text not null default 'draft' check (status in ('draft', 'running', 'paused', 'done')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, user_id),
  foreign key (mailbox_id, user_id) references public.mailboxes (id, user_id) on delete set null (mailbox_id)
);

create index campaigns_user_idx on public.campaigns (user_id, created_at desc);

create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();


-- ---------- prospects -----------------------------------------------------------------

create table public.prospects (
  id                   uuid primary key default gen_random_uuid(),
  -- CHANGE: user_id on every table so RLS checks ownership directly (no joins).
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  campaign_id          uuid not null,
  name                 text not null,
  -- CHANGE: first name for the greeting ("Hi Sam"), so the writer never guesses it from "name".
  first_name           text,
  title                text,
  company              text,
  domain               text,
  linkedin_url         text,
  -- CHANGE: location + IANA timezone, used to send only during the recipient's business hours.
  -- If unknown, the sender falls back to the user's profile timezone.
  location             text,
  timezone             text,
  email                text check (email is null or email = lower(email)),
  email_status         text not null default 'unchecked'
                         check (email_status in ('unchecked', 'valid', 'invalid', 'risky', 'unknown')),
  -- CHANGE: when and how the address was verified (audit trail for "valid").
  email_checked_at     timestamptz,
  email_check_provider text,
  research_notes       text,
  -- CHANGE: the one specific, true detail to mention, and the page it came from (so it can be checked).
  personal_detail      text,
  research_source_url  text,
  researched_at        timestamptz,
  source               text not null check (source in ('apollo', 'demo', 'manual')),
  -- CHANGE: the provider's own id for this person, for de-duplication across searches.
  source_ref           text,
  -- CHANGE: demo-provider rows. The sender refuses to send to these, and the database
  -- additionally requires demo addresses to use reserved example.* domains that reach nobody.
  is_demo              boolean not null default false,
  status               text not null default 'new' check (status in (
                         'new',          -- found, not yet researched/written
                         'ready',        -- researched, emails written, waiting to start
                         'active',       -- sequence in progress
                         'paused',       -- out-of-office pause; resumes at resume_at
                         'replied',      -- any reply: sequence stopped for good
                         'completed',    -- all 3 steps sent, no reply
                         'unsubscribed',
                         'bounced',
                         'excluded'      -- skipped (suppressed, role address, duplicate, invalid, ...)
                       )),
  -- CHANGE: when an out-of-office pause ends.
  resume_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, user_id),
  foreign key (campaign_id, user_id) references public.campaigns (id, user_id) on delete cascade,
  check (not is_demo or email is null or email ~ '@example\.(com|org|net)$')
);

-- CHANGE: the same email can appear only once per campaign.
create unique index prospects_campaign_email_key on public.prospects (campaign_id, email) where email is not null;
-- CHANGE: "never email the same person from two campaigns at once": at most one in-progress
-- (active or out-of-office paused) prospect per email address per user.
create unique index prospects_one_active_per_email on public.prospects (user_id, email)
  where email is not null and status in ('active', 'paused');
create index prospects_campaign_idx on public.prospects (campaign_id, created_at);
create index prospects_user_status_idx on public.prospects (user_id, status);

create trigger prospects_updated_at before update on public.prospects
  for each row execute function public.set_updated_at();

-- CHANGE: if an email address is changed, its verification no longer applies.
create or replace function public.reset_email_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    new.email_status = 'unchecked';
    new.email_checked_at = null;
    new.email_check_provider = null;
  end if;
  return new;
end;
$$;

create trigger prospects_reset_email_status before update of email on public.prospects
  for each row execute function public.reset_email_status();


-- ---------- messages ------------------------------------------------------------------

create table public.messages (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prospect_id    uuid not null,
  -- CHANGE: campaign and mailbox on the message, for stats and for counting each mailbox's daily cap.
  campaign_id    uuid not null,
  mailbox_id     uuid,
  step           smallint not null check (step between 1 and 3),
  subject        text not null default '',
  body           text not null default '',
  -- CHANGE: 'sending' is the claim state: a send job claims a message before sending so an
  -- overlapping or repeated cron run can never send it twice.
  status         text not null default 'draft' check (status in (
                   'draft',      -- written, not scheduled
                   'scheduled',  -- will be sent at scheduled_at
                   'sending',    -- claimed by a send job
                   'sent',
                   'failed',     -- gave up after retries (see error)
                   'cancelled'   -- sequence stopped (reply, unsubscribe, bounce, suppression, ...)
                 )),
  scheduled_at   timestamptz,
  claimed_at     timestamptz,
  sent_at        timestamptz,
  -- RFC 5322 Message-ID header of the sent email; replies are matched on it.
  message_id     text,
  -- CHANGE: retry bookkeeping so failures are recorded, not retried forever.
  attempts       integer not null default 0,
  error          text,
  -- CHANGE: when a bounce for this message was detected (feeds the 5% auto-pause).
  bounced_at     timestamptz,
  -- CHANGE: result of the "no invented facts" check against research_notes, shown in the UI.
  fact_check     jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, user_id),
  -- CHANGE: one message per step per prospect, so a re-run can never create a second step 2.
  unique (prospect_id, step),
  foreign key (prospect_id, user_id) references public.prospects (id, user_id) on delete cascade,
  foreign key (campaign_id, user_id) references public.campaigns (id, user_id) on delete cascade,
  foreign key (mailbox_id, user_id) references public.mailboxes (id, user_id) on delete set null (mailbox_id)
);

create unique index messages_message_id_key on public.messages (message_id) where message_id is not null;
create index messages_due_idx on public.messages (scheduled_at) where status = 'scheduled';
create index messages_mailbox_sent_idx on public.messages (mailbox_id, sent_at) where sent_at is not null;
create index messages_campaign_idx on public.messages (campaign_id, step);

create trigger messages_updated_at before update on public.messages
  for each row execute function public.set_updated_at();


-- ---------- replies -------------------------------------------------------------------

create table public.replies (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prospect_id         uuid not null,
  -- CHANGE: the sent message this reply answers (from In-Reply-To / References headers).
  message_id          uuid,
  mailbox_id          uuid,
  -- CHANGE: the reply's own Message-ID header, stored once, so re-reading the inbox never
  -- records or classifies the same reply twice.
  email_message_id    text not null,
  from_email          text,
  subject             text,
  received_at         timestamptz not null,
  snippet             text,
  category            text check (category in ('interested', 'not_now', 'not_interested', 'unsubscribe', 'out_of_office')),
  classified_at       timestamptz,
  -- CHANGE: out-of-office return date, if the auto-reply states one.
  ooo_return_date     date,
  -- CHANGE: drafted answer for interested replies (offers the user's Calendly link), sent on click.
  draft_reply         text,
  draft_sent_at       timestamptz,
  handled             boolean not null default false,
  created_at          timestamptz not null default now(),
  unique (user_id, email_message_id),
  foreign key (prospect_id, user_id) references public.prospects (id, user_id) on delete cascade,
  foreign key (message_id, user_id) references public.messages (id, user_id) on delete set null (message_id),
  foreign key (mailbox_id, user_id) references public.mailboxes (id, user_id) on delete set null (mailbox_id)
);

create index replies_user_received_idx on public.replies (user_id, received_at desc);
create index replies_prospect_idx on public.replies (prospect_id);


-- ---------- suppression (do-not-contact list) -----------------------------------------

create table public.suppression (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Exactly one of email / domain. CHANGE: always stored lowercase so matching is exact.
  email       text check (email is null or email = lower(email)),
  domain      text check (domain is null or domain = lower(domain)),
  reason      text not null check (reason in ('unsubscribe', 'not_interested', 'bounce', 'complaint', 'manual')),
  created_at  timestamptz not null default now(),
  check ((email is null) <> (domain is null))
);

-- CHANGE: one entry per email / domain per user.
create unique index suppression_user_email_key on public.suppression (user_id, email) where email is not null;
create unique index suppression_user_domain_key on public.suppression (user_id, domain) where domain is not null;


-- ---------- events (audit log) --------------------------------------------------------

create table public.events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null,
  -- IDs and short summaries only. Never secrets, credentials or full API responses.
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index events_user_created_idx on public.events (user_id, created_at desc);


-- =====================================================================================
-- Privileges: start from nothing, then grant only what the UI needs.
-- (The service role used by server jobs bypasses RLS and keeps full access.)
-- =====================================================================================

revoke all on public.profiles, public.mailboxes, public.campaigns, public.prospects,
              public.messages, public.replies, public.suppression, public.events
  from anon, authenticated;

-- profiles: users manage their own profile, including the pause-all switch.
grant select, insert on public.profiles to authenticated;
grant update (company_name, website, what_they_sell, sender_name, mailing_address,
              calendly_url, timezone, sending_paused, onboarded_at)
  on public.profiles to authenticated;

-- mailboxes: users connect/edit/remove mailboxes but can never READ the encrypted credentials.
-- IMAP bookmarks and last_error are written by server jobs only.
grant select (id, user_id, email, smtp_host, smtp_port, imap_host, imap_port, username,
              daily_cap, status, status_reason, last_error, last_checked_at, created_at, updated_at)
  on public.mailboxes to authenticated;
grant insert (user_id, email, smtp_host, smtp_port, imap_host, imap_port, username,
              encrypted_credentials, daily_cap)
  on public.mailboxes to authenticated;
grant update (email, smtp_host, smtp_port, imap_host, imap_port, username,
              encrypted_credentials, daily_cap, status, status_reason)
  on public.mailboxes to authenticated;
grant delete on public.mailboxes to authenticated;

-- campaigns: fully user-managed.
grant select, insert, delete on public.campaigns to authenticated;
grant update (mailbox_id, name, description, icp_json, search_plan_json, icp_approved_at, status)
  on public.campaigns to authenticated;

-- prospects: users can view and remove prospects and correct descriptive fields.
-- Email address, verification status, send status and demo flag are server-only.
grant select, delete on public.prospects to authenticated;
grant update (name, first_name, title, company, linkedin_url, research_notes, personal_detail)
  on public.prospects to authenticated;

-- messages: users can read all and edit subject/body of messages that have not been sent
-- (row filter in the policy below). Status, timing and send data are server-only.
grant select on public.messages to authenticated;
grant update (subject, body) on public.messages to authenticated;

-- replies: read, and mark handled.
grant select on public.replies to authenticated;
grant update (handled) on public.replies to authenticated;

-- suppression: users can view and add entries, but never remove them (unsubscribes are permanent).
grant select on public.suppression to authenticated;
grant insert (user_id, email, domain, reason) on public.suppression to authenticated;

-- events: read-only for users; written by the server.
grant select on public.events to authenticated;


-- =====================================================================================
-- Row Level Security: users only ever see their own rows.
-- (select auth.uid()) is evaluated once per query instead of once per row.
-- =====================================================================================

alter table public.profiles    enable row level security;
alter table public.mailboxes   enable row level security;
alter table public.campaigns   enable row level security;
alter table public.prospects   enable row level security;
alter table public.messages    enable row level security;
alter table public.replies     enable row level security;
alter table public.suppression enable row level security;
alter table public.events      enable row level security;

-- profiles
create policy "profiles: read own"   on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles: insert own" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles: update own" on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- mailboxes
create policy "mailboxes: read own"   on public.mailboxes for select to authenticated using ((select auth.uid()) = user_id);
create policy "mailboxes: insert own" on public.mailboxes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "mailboxes: update own" on public.mailboxes for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "mailboxes: delete own" on public.mailboxes for delete to authenticated using ((select auth.uid()) = user_id);

-- campaigns
create policy "campaigns: read own"   on public.campaigns for select to authenticated using ((select auth.uid()) = user_id);
create policy "campaigns: insert own" on public.campaigns for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "campaigns: update own" on public.campaigns for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "campaigns: delete own" on public.campaigns for delete to authenticated using ((select auth.uid()) = user_id);

-- prospects
create policy "prospects: read own"   on public.prospects for select to authenticated using ((select auth.uid()) = user_id);
create policy "prospects: update own" on public.prospects for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "prospects: delete own" on public.prospects for delete to authenticated using ((select auth.uid()) = user_id);

-- messages: editing only while not yet sent/claimed.
create policy "messages: read own" on public.messages for select to authenticated using ((select auth.uid()) = user_id);
create policy "messages: edit own unsent" on public.messages for update to authenticated
  using ((select auth.uid()) = user_id and status in ('draft', 'scheduled'))
  with check ((select auth.uid()) = user_id and status in ('draft', 'scheduled'));

-- replies
create policy "replies: read own"   on public.replies for select to authenticated using ((select auth.uid()) = user_id);
create policy "replies: update own" on public.replies for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- suppression: users may only add 'manual' entries; unsubscribes/bounces come from the server.
create policy "suppression: read own" on public.suppression for select to authenticated using ((select auth.uid()) = user_id);
create policy "suppression: add manual" on public.suppression for insert to authenticated
  with check ((select auth.uid()) = user_id and reason = 'manual');

-- events
create policy "events: read own" on public.events for select to authenticated using ((select auth.uid()) = user_id);
