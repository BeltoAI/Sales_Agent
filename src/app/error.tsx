"use client";

import { Button, LinkButton } from "@/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // In production Next.js replaces server error messages with a generic one, so nothing sensitive leaks.
  const setupHint = /Missing environment variable/.test(error.message) ? error.message : null;

  return (
    <main className="mx-auto flex max-w-lg flex-col items-center px-6 pt-32 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-sm text-muted">{setupHint ?? "Please try again. If it keeps happening, reload the page."}</p>
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <LinkButton href="/" variant="secondary">
          Home
        </LinkButton>
      </div>
    </main>
  );
}
