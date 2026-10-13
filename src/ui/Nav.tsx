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
    <Link href={href} className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-fg">
      <span aria-hidden className="size-2 rounded-full bg-accent" />
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
    <header className="sticky top-3 z-20 px-4">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 rounded-full border border-border bg-surface/80 pr-2 pl-5 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <Brand href={brandHref} />
        {items.length > 0 && (
          <nav aria-label="Main" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {items.map((item) => {
              if (item.disabled) {
                return (
                  <span
                    key={item.href}
                    aria-disabled
                    className="flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-subtle"
                  >
                    {item.label}
                    <span className="rounded-full border border-border px-1 text-[10px] uppercase tracking-wide">Soon</span>
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
                    "shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors",
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
