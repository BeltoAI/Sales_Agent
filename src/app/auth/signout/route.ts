import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** POST-only so a link or image can't log someone out. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Even if Supabase is unreachable, send the user home; the cookie is cleared on the next refresh.
  }
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
}
