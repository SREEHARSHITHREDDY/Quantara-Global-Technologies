"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { AuthShell, FormError, FormNotice, TextField } from "./auth-ui";

export function ForgotPasswordForm() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setPending(true);
    const { error: err } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setPending(false);
    if (err && err.status === 429) return setError("Too many requests. Please wait a few minutes and try again.");
    setDone(true); // identical response whether or not the address is registered
  }
  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we will send you a link to choose a new password."
      footer={<Link className="font-medium text-electric-600 hover:underline" href="/sign-in">Back to sign in</Link>}>
      {done ? <FormNotice>If an account exists for that address, a reset link is on its way. The link is valid for one hour.</FormNotice> : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <FormError message={error} />
          <TextField id="email" label="Email" type="email" autoComplete="email" required />
          <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Sending..." : "Send reset link"}</Button>
        </form>
      )}
    </AuthShell>
  );
}
