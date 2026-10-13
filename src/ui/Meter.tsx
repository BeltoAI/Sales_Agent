import { cn } from "./cn";

/**
 * A single ratio against a limit (e.g. sent today / daily cap). The fill carries severity
 * (accent → warning at 80% → danger at 100%); the track is a lighter step of the same hue.
 * The numbers are always shown as text too, so state never depends on color alone.
 */
export function Meter({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const tone = ratio >= 1 ? "danger" : ratio >= 0.8 ? "warning" : "accent";
  const track = { accent: "bg-accent/15", warning: "bg-warning/15", danger: "bg-danger/15" }[tone];
  const fill = { accent: "bg-accent", warning: "bg-warning", danger: "bg-danger" }[tone];

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="text-fg tabular-nums">
          {value} / {max}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className={cn("h-1.5 w-full overflow-hidden rounded-full", track)}
      >
        <div className={cn("h-full rounded-full transition-[width]", fill)} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}
