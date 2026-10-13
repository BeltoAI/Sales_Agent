import type { ReactNode } from "react";
import { requireProfile, requireUser } from "@/lib/auth";
import { Nav, type NavItem } from "@/ui";
import { SignOutButton } from "../SignOutButton";

// Sections that later phases fill in are shown as "Soon" so nothing links to a 404.
const items: NavItem[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/dashboard/replies", label: "Replies", disabled: true },
  { href: "/dashboard/mailboxes", label: "Mailboxes" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Real server-side check (the proxy is only a fast first gate), then require a finished profile.
  const { user } = await requireUser();
  await requireProfile();

  return (
    <>
      <Nav
        brandHref="/dashboard"
        items={items}
        actions={
          <>
            <span className="hidden max-w-48 truncate text-xs text-muted sm:inline" title={user.email ?? undefined}>
              {user.email}
            </span>
            <SignOutButton />
          </>
        }
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
