"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, Card, CardBody, Input } from "@/ui";

/**
 * Placeholder sign-up / log-in form. It does not authenticate anyone yet:
 * Supabase Auth (magic link + Google) is wired up in a later phase.
 */
export function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const [notice, setNotice] = useState<string | null>(null);
  const isSignup = mode === "signup";

  function placeholder(e?: FormEvent) {
    e?.preventDefault();
    setNotice("Sign-in isn't connected yet. It arrives in a later phase. You can preview the dashboard for now.");
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">{isSignup ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-2 text-sm text-muted">
        {isSignup ? "Start finding the right customers." : "Log in to your Sales Agent dashboard."}
      </p>

      <Card className="mt-8">
        <CardBody className="flex flex-col gap-4 py-6">
          <Button variant="secondary" className="w-full" onClick={() => placeholder()}>
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-xs text-subtle">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={placeholder} className="flex flex-col gap-4">
            <Input
              type="email"
              name="email"
              label="Work email"
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
            <Button type="submit" className="w-full">
              Email me a magic link
            </Button>
          </form>

          {notice && (
            <p role="status" className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
              {notice}{" "}
              <Link href="/dashboard" className="text-accent hover:underline">
                Preview dashboard →
              </Link>
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
