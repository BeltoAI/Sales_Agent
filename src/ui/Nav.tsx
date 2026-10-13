"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type NavItem = {
  href: string;
  label: string;
  /** Shown greyed out with a "Soon" tag, not clickable. */
  disabled?: boolean;
};

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
      <span aria-hidden className="grid size-6 place-items-center rounded-md bg-accent text-[11px] font-bold text-accent-fg">
        SA
      </span>
      Sales Agent
    </Link>
  );
}

/** Top navigation bar: brand on the left, links in the middle, actions on the right. */
export function Nav({
  items = [],
  actions,
  brandHref = "/",
}: {
  items?: NavItem[];
  actions?: ReactNode;
  brandHref?: string;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Brand href={brandHref} />
        {items.length > 0 && (
          <nav aria-label="Main" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {items.map((item) => {
              if (item.disabled) {
                return (
                  <span
                    key={item.href}
                    aria-disabled
                    className="flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-subtle"
                  >
                    {item.label}
                    <span className="rounded border border-border px-1 text-[10px] uppercase tracking-wide">Soon</span>
                  </span>
                );
              }
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors",
                    active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}
