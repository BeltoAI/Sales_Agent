import type { Metadata } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const grotesk = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Sales Agent",
    template: "%s · Sales Agent",
  },
  description: "AI agents that find the right people, research them, and send honest, personal outreach from your own mailbox.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={grotesk.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
