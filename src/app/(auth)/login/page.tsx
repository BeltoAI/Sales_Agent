import type { Metadata } from "next";
import { safeNextPath } from "@/lib/safe-redirect";
import { AuthForm } from "../AuthForm";
import { authErrorMessage } from "../errors";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <AuthForm
      mode="login"
      next={safeNextPath(typeof next === "string" ? next : null)}
      initialError={authErrorMessage(error)}
    />
  );
}
