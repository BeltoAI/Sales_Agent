import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:pointer-events-none disabled:opacity-50 active:translate-y-px";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[linear-gradient(180deg,var(--color-accent-2),var(--color-accent))] text-accent-fg " +
    "border border-accent-2/40 shadow-[0_10px_30px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.25)] hover:opacity-95",
  secondary:
    "border border-border bg-[linear-gradient(180deg,#2e2e38,#1e1e24)] text-fg hover:border-border-strong",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props} />;
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize };

/** A Next.js link that looks like a Button. */
export function LinkButton({ variant, size, className, ...props }: LinkButtonProps) {
  return <Link className={buttonStyles({ variant, size, className })} {...props} />;
}
