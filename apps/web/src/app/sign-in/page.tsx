import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/sign-in-form";
export const metadata: Metadata = { title: "Sign in" };
export default async function Page({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const sp = await searchParams;
  return <SignInForm {...(sp.reset ? { notice: "Your password has been changed. Sign in with your new password." } : {})} />;
}
