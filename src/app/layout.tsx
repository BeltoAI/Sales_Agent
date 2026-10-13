import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sales Agent",
    template: "%s · Sales Agent",
  },
  description: "AI agents that find the right people, research them, and send honest, personal outreach from your own mailbox.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
