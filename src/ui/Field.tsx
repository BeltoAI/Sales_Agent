import type { ReactNode } from "react";

/** Shared label / hint / error wrapper used by Input and Textarea. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export const controlStyles =
  "w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg placeholder:text-subtle " +
  "transition-colors hover:border-border-strong " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "aria-[invalid=true]:border-danger";
