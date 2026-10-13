import "server-only";

import { createClient } from "@supabase/supabase-js";
import { MissingEnvError, supabaseUrl } from "@/lib/env";

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 *
 * Only for background jobs (cron routes) and agent writes to columns users may not change
 * (e.g. email verification status). Every query made with it MUST filter by user_id explicitly.
 * The `server-only` import makes the build fail if this file is ever imported into browser code.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new MissingEnvError("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
