import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";
import { Field, controlStyles } from "./Field";

type TextareaProps = ComponentProps<"textarea"> & { label?: ReactNode; hint?: ReactNode; error?: ReactNode };

export function Textarea({ label, hint, error, id, className, rows = 4, ...props }: TextareaProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  return (
    <Field id={textareaId} label={label} hint={hint} error={error}>
      <textarea
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
        className={cn(controlStyles, "resize-y py-2 leading-relaxed", className)}
        {...props}
      />
    </Field>
  );
}
