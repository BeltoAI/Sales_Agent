import type { ReactNode } from "react";
import { LinkButton, Nav, type NavItem } from "@/ui";

// Sections that later phases fill in are shown as "Soon" so nothing links to a 404.
const items: NavItem[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/campaigns", label: "Campaigns", disabled: true },
  { href: "/dashboard/prospects", label: "Prospects", disabled: true },
  { href: "/dashboard/replies", label: "Replies", disabled: true },
  { href: "/dashboard/settings", label: "Settings", disabled: true },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav
        brandHref="/dashboard"
        items={items}
        actions={
          <LinkButton href="/" variant="ghost" size="sm">
            Log out
          </LinkButton>
        }
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
