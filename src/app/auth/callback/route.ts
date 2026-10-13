import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["magiclink", "signup", "email", "invite", "recovery", "email_change"];

/**
 * Where magic links and Google sign-in land.
 *  - ?code=...                 PKCE flow (default for magic links and OAuth with @supabase/ssr)
 *  - ?token_hash=...&type=...  if the Supabase email template is customised to link here directly
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, origin));

  try {
    const supabase = await createClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return fail("link_invalid");
    } else if (tokenHash && type && OTP_TYPES.includes(type)) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) return fail("link_invalid");
    } else {
      return fail("link_invalid");
    }
  } catch {
    return fail("auth_failed");
  }

  // The dashboard layout sends users without a finished profile to /onboarding.
  return NextResponse.redirect(new URL(next, origin));
}
