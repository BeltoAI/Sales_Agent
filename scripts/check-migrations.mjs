/**
 * Applies every SQL file in supabase/migrations to an in-memory Postgres (PGlite) that mimics
 * Supabase's roles and auth.uid(), then checks the Row Level Security and privilege rules.
 * No Supabase account or network needed:  npm run test:db
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = join(import.meta.dirname, "..", "supabase", "migrations");

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  -- Supabase grants everything on new public tables to these roles by default;
  -- the migration must revoke what it doesn't want.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";

const db = new PGlite();
let passed = 0;
let failed = 0;

/** Run SQL as a role (and user), inside a transaction that is always rolled back unless keep=true. */
async function as(role, uid, sql, params = [], keep = false) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? ""]);
    await tx.query(`set local role ${role}`);
    const res = await tx.query(sql, params);
    if (!keep) await tx.rollback();
    return res;
  });
}
const user = (uid, sql, params, keep) => as("authenticated", uid, sql, params, keep);
const service = (sql, params) => as("service_role", null, sql, params, true);

async function expectOk(name, fn, check) {
  try {
    const res = await fn();
    if (check && !check(res)) throw new Error(`unexpected result: ${JSON.stringify(res.rows ?? res)}`);
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}

async function expectFail(name, fn, pattern) {
  try {
    await fn();
    failed++;
    console.log(`  ✗ ${name}\n      expected an error, but it succeeded`);
  } catch (e) {
    if (pattern && !pattern.test(e.message)) {
      failed++;
      console.log(`  ✗ ${name}\n      wrong error: ${e.message}`);
      return;
    }
    passed++;
    console.log(`  ✓ ${name}`);
  }
}

const rows = (n) => (res) => res.rows.length === n;
const affected = (n) => (res) => res.affectedRows === n;

// ---------------------------------------------------------------------------------------------
console.log("Applying migrations to in-memory Postgres…");
await db.exec(SUPABASE_STUB);
for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  console.log(`  ✓ ${file}`);
}
await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@test.dev'), ('${B}', 'b@test.dev')`);

const profileSql = `insert into public.profiles (user_id, company_name, what_they_sell, sender_name, mailing_address, timezone)
                    values ($1, 'Acme', 'Route planning software', 'Ann', '1 Main St, Springfield', 'UTC')`;

console.log("\nprofiles");
await expectOk("user A can create their own profile", () => user(A, profileSql, [A], true));
await expectOk("user B can create their own profile", () => user(B, profileSql, [B], true));
await expectFail("user B cannot create a profile for user A", () => user(B, profileSql, [A]), /row-level security/);
await expectOk("user B sees only their own profile", () => user(B, "select user_id from public.profiles"), (r) =>
  r.rows.length === 1 && r.rows[0].user_id === B);
await expectOk("user A can flip the pause-all switch", () =>
  user(A, "update public.profiles set sending_paused = true where user_id = $1", [A]), affected(1));
await expectOk("user A cannot update user B's profile (0 rows)", () =>
  user(A, "update public.profiles set company_name = 'x' where user_id = $1", [B]), affected(0));
await expectFail("anonymous visitors cannot read profiles", () => as("anon", null, "select * from public.profiles"), /permission denied/);

console.log("\nmailboxes");
const mailboxSql = `insert into public.mailboxes (user_id, email, smtp_host, smtp_port, imap_host, username, encrypted_credentials)
                    values ($1, $2, 'smtp.test', 465, 'imap.test', $2, 'v1:aaa:bbb:ccc') returning id`;
let mailboxA;
await expectOk("user A can connect a mailbox", async () => {
  // Users can't read back all columns, so read the id as service role.
  await user(A, mailboxSql.replace(" returning id", ""), [A, "ann@acme.test"], true);
  mailboxA = (await service("select id from public.mailboxes where user_id = $1", [A])).rows[0].id;
  return { rows: [mailboxA] };
});
await expectFail("user A cannot read encrypted credentials", () =>
  user(A, "select encrypted_credentials from public.mailboxes"), /permission denied/);
await expectOk("user A can read the safe mailbox columns", () =>
  user(A, "select id, email, daily_cap, status from public.mailboxes"), rows(1));
await expectFail("daily cap cannot exceed 50", () =>
  user(A, "update public.mailboxes set daily_cap = 51 where id = $1", [mailboxA]), /check constraint/);
await expectOk("user can lower daily cap", () =>
  user(A, "update public.mailboxes set daily_cap = 10 where id = $1", [mailboxA]), affected(1));
await expectFail("user cannot move the IMAP bookmark", () =>
  user(A, "update public.mailboxes set last_seen_uid = 1 where id = $1", [mailboxA]), /permission denied/);
await expectFail("port 25 is rejected", () =>
  user(A, mailboxSql.replace("465", "25").replace(" returning id", ""), [A, "x@acme.test"]), /check constraint/);
await expectOk("user B cannot see user A's mailbox", () => user(B, "select id from public.mailboxes"), rows(0));

console.log("\ncampaigns");
await expectFail("user B cannot attach user A's mailbox to their campaign", () =>
  user(B, "insert into public.campaigns (user_id, name, mailbox_id) values ($1, 'x', $2)", [B, mailboxA]), /foreign key/);
const campA1 = (await service("insert into public.campaigns (user_id, name, mailbox_id) values ($1, 'C1', $2) returning id", [A, mailboxA])).rows[0].id;
const campA2 = (await service("insert into public.campaigns (user_id, name) values ($1, 'C2') returning id", [A])).rows[0].id;
await expectOk("user A can create a campaign", () =>
  user(A, "insert into public.campaigns (user_id, name) values ($1, 'mine')", [A]), affected(1));
await expectOk("user B cannot see user A's campaigns", () => user(B, "select id from public.campaigns"), rows(0));

console.log("\nprospects");
const prospectSql = `insert into public.prospects (user_id, campaign_id, name, email, source, is_demo, status)
                     values ($1, $2, 'Sam', $3, $4, $5, $6) returning id`;
await expectFail("users cannot insert prospects directly (server only)", () =>
  user(A, prospectSql, [A, campA1, "sam@corp.test", "manual", false, "new"]), /permission denied/);
const p1 = (await service(prospectSql, [A, campA1, "sam@corp.test", "apollo", false, "active"])).rows[0].id;
await expectFail("demo prospects must use example.* addresses", () =>
  service(prospectSql, [A, campA1, "real@corp.test", "demo", true, "new"]), /check constraint/);
await expectOk("demo prospect with example.com is allowed", () =>
  service(prospectSql, [A, campA1, "demo1@example.com", "demo", true, "new"]), rows(1));
await expectFail("emails must be stored lowercase", () =>
  service(prospectSql, [A, campA1, "Big@Corp.test", "apollo", false, "new"]), /check constraint/);
await expectFail("same email twice in one campaign is rejected", () =>
  service(prospectSql, [A, campA1, "sam@corp.test", "apollo", false, "new"]), /duplicate key/);
await expectFail("same person active in two campaigns at once is rejected", () =>
  service(prospectSql, [A, campA2, "sam@corp.test", "apollo", false, "active"]), /duplicate key/);
await expectOk("same person may be in a second campaign once not active", () =>
  service(prospectSql, [A, campA2, "sam@corp.test", "apollo", false, "new"]), rows(1));
await expectFail("user cannot mark an email as verified", () =>
  user(A, "update public.prospects set email_status = 'valid' where id = $1", [p1]), /permission denied/);
await expectFail("user cannot change a prospect's send status", () =>
  user(A, "update public.prospects set status = 'active' where id = $1", [p1]), /permission denied/);
await expectOk("changing an email resets its verification", async () => {
  await service("update public.prospects set email_status = 'valid' where id = $1", [p1]);
  await service("update public.prospects set email = 'sam2@corp.test' where id = $1", [p1]);
  return service("select email_status from public.prospects where id = $1", [p1]);
}, (r) => r.rows[0].email_status === "unchecked");
await expectOk("user B cannot see user A's prospects", () => user(B, "select id from public.prospects"), rows(0));

console.log("\nmessages");
const msgSql = `insert into public.messages (user_id, prospect_id, campaign_id, step, subject, body, status)
                values ($1, $2, $3, $4, 's', 'b', $5) returning id`;
const m1 = (await service(msgSql, [A, p1, campA1, 1, "scheduled"])).rows[0].id;
const m2 = (await service(msgSql, [A, p1, campA1, 2, "sent"])).rows[0].id;
await expectFail("only one message per step per prospect", () => service(msgSql, [A, p1, campA1, 1, "draft"]), /duplicate key/);
await expectFail("users cannot insert messages directly", () => user(A, msgSql, [A, p1, campA1, 3, "draft"]), /permission denied/);
await expectOk("user can edit an unsent message", () =>
  user(A, "update public.messages set body = 'edited' where id = $1", [m1]), affected(1));
await expectOk("user cannot edit a sent message (0 rows)", () =>
  user(A, "update public.messages set body = 'edited' where id = $1", [m2]), affected(0));
await expectFail("user cannot change a message's status", () =>
  user(A, "update public.messages set status = 'sent' where id = $1", [m1]), /permission denied/);
await expectFail("user cannot change scheduled_at", () =>
  user(A, "update public.messages set scheduled_at = now() where id = $1", [m1]), /permission denied/);

console.log("\nsuppression");
await expectOk("user can add a manual suppression", () =>
  user(A, "insert into public.suppression (user_id, email, reason) values ($1, 'no@corp.test', 'manual')", [A], true), affected(1));
await expectFail("user cannot add an 'unsubscribe' entry themselves", () =>
  user(A, "insert into public.suppression (user_id, email, reason) values ($1, 'x@corp.test', 'unsubscribe')", [A]), /row-level security/);
await expectFail("user cannot remove suppression entries", () =>
  user(A, "delete from public.suppression"), /permission denied/);
await expectFail("suppression needs exactly one of email/domain", () =>
  service(`insert into public.suppression (user_id, email, domain, reason) values ('${A}', 'a@b.test', 'b.test', 'manual')`), /check constraint/);
await expectOk("user B cannot see user A's suppression list", () => user(B, "select id from public.suppression"), rows(0));

console.log("\nevents");
await service(`insert into public.events (user_id, type) values ('${A}', 'test')`);
await expectFail("users cannot write to the audit log", () =>
  user(A, `insert into public.events (user_id, type) values ($1, 'fake')`, [A]), /permission denied/);
await expectFail("users cannot delete from the audit log", () => user(A, "delete from public.events"), /permission denied/);
await expectOk("user A sees their own events", () => user(A, "select id from public.events"), rows(1));
await expectOk("user B cannot see user A's events", () => user(B, "select id from public.events"), rows(0));

console.log("\nevery public table has RLS enabled");
await expectOk("RLS on all tables", () =>
  db.query(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`), rows(0));

console.log(`\n${passed} passed, ${failed} failed`);
await db.close();
process.exit(failed ? 1 : 0);
