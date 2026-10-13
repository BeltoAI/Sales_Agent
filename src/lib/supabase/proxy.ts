import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv, supabaseAnonKey, supabaseUrl } from "@/lib/env";

/** Paths that require a logged-in user. Pages re-check on the server; this is the fast first gate. */
const PROTECTED_PREFIXES = ["/dashboard", "/onboarding"];
/** Auth pages a logged-in user should skip. */
const AUTH_PAGES = ["/login", "/signup"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session cookie on each request and does optimistic redirects.
 * Real authorization happens again in each protected layout/page and in RLS.
 */
export async function updateSession(request: NextRequest) {
  // Without Supabase settings, let public pages render; protected pages show a clear setup error.
  if (!hasSupabaseEnv()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not put code between createServerClient and getClaims: it validates and refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = params ? `?${new URLSearchParams(params)}` : "";
    const redirect = NextResponse.redirect(url);
    // Keep any refreshed auth cookies (and their no-cache headers) on the redirect.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    const cacheControl = response.headers.get("cache-control");
    if (cacheControl) redirect.headers.set("cache-control", cacheControl);
    return redirect;
  };

  if (!isLoggedIn && matches(pathname, PROTECTED_PREFIXES)) {
    return redirectTo("/login", { next: pathname + search });
  }

  if (isLoggedIn && matches(pathname, AUTH_PAGES)) {
    return redirectTo("/dashboard");
  }

  return response;
}
