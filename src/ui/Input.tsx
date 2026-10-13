import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";
import { Field, controlStyles } from "./Field";

type InputProps = ComponentProps<"input"> & { label?: ReactNode; hint?: ReactNode; error?: ReactNode };

export function Input({ label, hint, error, id, className, ...props }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field id={inputId} label={label} hint={hint} error={error}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(controlStyles, "h-10", className)}
        {...props}
      />
    </Field>
  );
}
