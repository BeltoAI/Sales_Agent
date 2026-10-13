import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * The real auth check for protected pages and actions (the proxy is only an optimistic gate).
 * getUser() asks the Supabase Auth server, so a forged or revoked cookie is rejected.
 * Cached per request so layout + page share one lookup.
 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { supabase, user: data.user };
});

/** The current user's profile, or null if they have not finished onboarding. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (error) throw new Error(`Could not load profile: ${error.message}`);
  return (data as Profile | null) ?? null;
});

/** For pages that need a finished profile: sends the user to onboarding first. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile?.onboarded_at) redirect("/onboarding");
  return profile;
}
