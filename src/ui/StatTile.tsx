import type { ReactNode } from "react";
import { Card } from "./Card";
import { cn } from "./cn";

/** Auto-compact large numbers: 1,284 / 12.9K / 4.2M. */
export function compactNumber(n: number): string {
  if (Math.abs(n) < 10_000) return n.toLocaleString("en-US");
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** One headline number. Proportional figures (no tabular-nums) read better at display size. */
export function StatTile({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <Card className={cn("px-5 py-4", className)}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-fg">{typeof value === "number" ? compactNumber(value) : value}</p>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </Card>
  );
}
