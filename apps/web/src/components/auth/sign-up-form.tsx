"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { AuthShell, FormError, FormNotice, MIN_PASSWORD, TextField, passwordProblem } from "./auth-ui";

export function SignUpForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim(), email = String(f.get("email") ?? "").trim(), password = String(f.get("password") ?? "");
    if (!name) return setError("Enter your name.");
    const problem = passwordProblem(password, String(f.get("confirm") ?? ""));
    if (problem) return setError(problem);
    setPending(true);
    const { error: err } = await authClient.signUp.email({ name, email, password, callbackURL: "/verify-email" });
    setPending(false);
    if (err) return setError(err.message || "We could not create your account. Please try again.");
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <AuthShell title="Check your email" subtitle={`We sent a verification link to ${sentTo}. Open it to activate your account, then sign in.`}
        footer={<Link className="font-medium text-electric-600 hover:underline" href="/sign-in">Go to sign in</Link>}>
        {resent && <FormNotice>A new verification email has been requested.</FormNotice>}
        <p className="mt-4 text-sm text-slate-600">Didn&apos;t get it? Check your spam folder, or</p>
        <Button variant="outline" className="mt-3" onClick={async () => { await authClient.sendVerificationEmail({ email: sentTo, callbackURL: "/verify-email" }); setResent(true); }}>Resend verification email</Button>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Create your account" subtitle="Your account gives you a private workspace for the Executive AI Council."
      footer={<>Already have an account? <Link className="font-medium text-electric-600 hover:underline" href="/sign-in">Sign in</Link></>}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormError message={error} />
        <TextField id="name" label="Full name" autoComplete="name" required />
        <TextField id="email" label="Work email" type="email" autoComplete="email" required />
        <TextField id="password" label="Password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} hint={`At least ${MIN_PASSWORD} characters.`} />
        <TextField id="confirm" label="Confirm password" type="password" autoComplete="new-password" required />
        <p className="text-xs text-slate-500">By creating an account you agree to the <Link className="underline" href="/terms">Terms of Use</Link> and <Link className="underline" href="/privacy-policy">Privacy Policy</Link>.</p>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Creating account..." : "Create account"}</Button>
      </form>
    </AuthShell>
  );
}
