"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, Card, CardBody, Input } from "@/ui";
import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

function callbackUrl(next: string) {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", next);
  return url.toString();
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/Missing environment variable/.test(msg)) return msg;
  if (/rate limit/i.test(msg)) return "Too many attempts. Please wait a minute and try again.";
  return "Something went wrong. Please try again.";
}

export function AuthForm({ mode, next, initialError }: { mode: "signup" | "login"; next: string; initialError?: string }) {
  const [status, setStatus] = useState<Status>(initialError ? { kind: "error", message: initialError } : { kind: "idle" });
  const isSignup = mode === "signup";
  const busy = status.kind === "working";

  async function sendMagicLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim().toLowerCase();
    if (!email) return;
    setStatus({ kind: "working" });
    try {
      const { error } = await createClient().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl(next), shouldCreateUser: true },
      });
      if (error) throw error;
      setStatus({ kind: "sent", email });
    } catch (err) {
      setStatus({ kind: "error", message: friendlyError(err) });
    }
  }
  
  if (status.kind === "sent") {
    return (
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
              We sent a sign-in link to <span className="text-fg">{status.email}</span>. Open it in this same browser to
          continue. You can close this tab.
        </p>
        <Button variant="ghost" size="sm" className="mt-6 -ml-3" onClick={() => setStatus({ kind: "idle" })}>
          ← Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">{isSignup ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-2 text-sm text-muted">
        {isSignup ? "Start finding the right customers." : "Log in to your Sales Agent dashboard."}
      </p>

      <Card className="mt-8">
        <CardBody className="flex flex-col gap-4 py-6">
          <form onSubmit={sendMagicLink} className="flex flex-col gap-4">
            <Input
              type="email"
              name="email"
              label="Work email"
              placeholder="you@company.com"
              autoComplete="email"
              required
              disabled={busy}
            />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Email me a magic link"}
            </Button>
          </form>

          {status.kind === "error" && (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {status.message}
            </p>
          )}
        </CardBody>
      </Card>

      <p className="mt-6 text-center text-sm text-muted">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link href={isSignup ? "/login" : "/signup"} className="text-fg hover:underline">
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
