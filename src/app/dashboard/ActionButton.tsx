"use client";

import { useState, useTransition } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/ui";

type Result = { ok: boolean; message: string };

/** A button that runs a server action and shows its result message underneath. */
export function ActionButton({
  action,
  children,
  pendingLabel = "Working…",
  variant = "secondary",
  size = "sm",
  confirmText,
  disabled,
}: {
  action: () => Promise<Result | void>;
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  confirmText?: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant={variant}
        size={size}
        disabled={pending || disabled}
        onClick={() => {
          if (confirmText && !confirm(confirmText)) return;
          start(async () => setResult((await action()) ?? null));
        }}
      >
        {pending ? pendingLabel : children}
      </Button>
      {!pending && result?.message && (
        <p role="status" className={`max-w-xl text-sm ${result.ok ? "text-success" : "text-danger"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
