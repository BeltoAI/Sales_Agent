"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/** Supabase client for Client Components. Uses the public anon key; RLS protects all data. */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
