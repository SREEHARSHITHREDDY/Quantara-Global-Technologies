import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-ui";

export const metadata: Metadata = { title: "Email verification", robots: { index: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const failed = !!(await searchParams).error;
  return failed ? (
    <AuthShell title="Verification link not valid" subtitle="This link is invalid or has expired. Sign in and we will send you a new verification email.">
      <ButtonLink href="/sign-in">Go to sign in</ButtonLink>
    </AuthShell>
  ) : (
    <AuthShell title="Email verified" subtitle="Your email address is confirmed. You can now sign in.">
      <ButtonLink href="/sign-in">Sign in</ButtonLink>
    </AuthShell>
  );
}
