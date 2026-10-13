/**
 * Environment variable access. Errors name the missing variable but never print values.
 *
 * NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so they must be
 * read with literal `process.env.NEXT_PUBLIC_X` expressions (no dynamic lookup).
 */

export class MissingEnvError extends Error {
  constructor(name: string) {
    super(`Missing environment variable ${name}. Add it to .env.local (see .env.example) and restart the dev server.`);
    this.name = "MissingEnvError";
  }
}

function required(name: string, value: string | undefined): string {
  if (!value || !value.trim()) throw new MissingEnvError(name);
  return value.trim();
}

export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** True when the public Supabase settings are present (used to fail soft in the proxy). */
export function hasSupabaseEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
}
