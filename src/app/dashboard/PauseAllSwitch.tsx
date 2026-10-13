"use client";

import { useOptimistic, useTransition } from "react";
import { setSendingPaused } from "./actions";

/** The global "Pause all sending" switch. Checked by the sender before every single email. */
export function PauseAllSwitch({ paused }: { paused: boolean }) {
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(paused);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await setSendingPaused(!optimistic);
        })
      }
      className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
        optimistic ? "border-warning/40 bg-warning/10 text-warning" : "border-border bg-surface text-fg hover:border-border-strong"
      }`}
    >
      <span className={`relative h-5 w-9 rounded-full transition-colors ${optimistic ? "bg-warning" : "bg-surface-2 ring-1 ring-border"}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-fg transition-all ${optimistic ? "left-[18px]" : "left-0.5"}`} />
      </span>
      {optimistic ? "All sending paused" : "Pause all sending"}
    </button>
  );
}
