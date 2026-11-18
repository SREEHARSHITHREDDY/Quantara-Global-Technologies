import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const sp = await searchParams;
  return <ResetPasswordForm {...(sp.token ? { token: sp.token } : {})} invalid={!!sp.error} />;
}
