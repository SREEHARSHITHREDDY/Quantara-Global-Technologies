"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { AuthShell, FormError, MIN_PASSWORD, TextField, passwordProblem } from "./auth-ui";

export function ResetPasswordForm({ token, invalid }: { token?: string; invalid?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (!token || invalid) {
    return (
      <AuthShell title="This link is not valid" subtitle="The password reset link is invalid or has expired."
        footer={<Link className="font-medium text-electric-600 hover:underline" href="/forgot-password">Request a new link</Link>}><span /></AuthShell>
    );
  }
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const f = new FormData(e.currentTarget); const pw = String(f.get("password") ?? "");
    const problem = passwordProblem(pw, String(f.get("confirm") ?? "")); if (problem) return setError(problem);
    setPending(true);
    const { error: err } = await authClient.resetPassword({ newPassword: pw, token: token! });
    setPending(false);
    if (err) return setError("This link is invalid or has expired. Please request a new one.");
    router.push("/sign-in?reset=1");
  }
  return (
    <AuthShell title="Choose a new password" subtitle="Signing in on other devices will be ended once you change it.">
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormError message={error} />
        <TextField id="password" label="New password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} hint={`At least ${MIN_PASSWORD} characters.`} />
        <TextField id="confirm" label="Confirm new password" type="password" autoComplete="new-password" required />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Saving..." : "Set new password"}</Button>
      </form>
    </AuthShell>
  );
}
