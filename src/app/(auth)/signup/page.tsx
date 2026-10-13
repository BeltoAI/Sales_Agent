import type { Metadata } from "next";
import { safeNextPath } from "@/lib/safe-redirect";
import { AuthForm } from "../AuthForm";
import { authErrorMessage } from "../errors";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next, error } = await searchParams;
  return (
    <AuthForm
      mode="signup"
      next={safeNextPath(typeof next === "string" ? next : null)}
      initialError={authErrorMessage(error)}
    />
  );
}
