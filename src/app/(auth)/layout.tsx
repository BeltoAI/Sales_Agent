import type { ReactNode } from "react";
import { Nav } from "@/ui";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      <main className="flex justify-center px-6 pt-20 pb-24">{children}</main>
    </>
  );
}
