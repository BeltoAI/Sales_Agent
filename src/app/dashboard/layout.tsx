import type { ReactNode } from "react";
import { requireProfile, requireUser } from "@/lib/auth";
import { Nav, type NavItem } from "@/ui";
import { SignOutButton } from "../SignOutButton";
import { PauseAllSwitch } from "./PauseAllSwitch";

// Sections that later phases fill in are shown as "Soon" so nothing links to a 404.
const items: NavItem[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/mailboxes", label: "Mailboxes" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Real server-side check (the proxy is only a fast first gate), then require a finished profile.
  const { user } = await requireUser();
  const profile = await requireProfile();

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
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
          {profile.sending_paused && <p className="text-sm text-warning">No emails will be sent until you turn this off.</p>}
          <PauseAllSwitch paused={profile.sending_paused} />
        </div>
        {children}
      </main>
    </>
  );
}
