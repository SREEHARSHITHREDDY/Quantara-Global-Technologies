"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { AuthShell, FormError, FormNotice, TextField } from "./auth-ui";

export function SignInForm({ notice, variant = "customer" }: { notice?: string; variant?: "customer" | "staff" }) {
  const staff = variant === "staff";
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setNeedsVerification(null);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim(), password = String(f.get("password") ?? "");
    setPending(true);
    const { data, error: err } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (err) {
      if (err.status === 403) return setNeedsVerification(email); // email not verified yet
      return setError(err.status === 429 ? "Too many attempts. Please wait a minute and try again." : "Invalid email or password.");
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return; // the client plugin redirects to /two-factor
    router.push(staff ? "/admin" : "/account"); router.refresh();
  }

  return (
    <AuthShell title={staff ? "Staff access" : "Sign in"} subtitle={staff ? "For authorised Quantara personnel only. Customer accounts cannot use this page." : "Access your Quantara workspace."}
      footer={staff ? undefined : <>New to Quantara? <Link className="font-medium text-electric-600 hover:underline" href="/sign-up">Create an account</Link></>}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {notice && <FormNotice>{notice}</FormNotice>}
        <FormError message={error} />
        {needsVerification && (
          <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Please verify your email address first. We sent a link when you signed up.
            {resent ? <p className="mt-2 font-medium">A new verification email has been requested.</p> :
              <button type="button" className="mt-2 block font-medium underline" onClick={async () => { await authClient.sendVerificationEmail({ email: needsVerification, callbackURL: "/verify-email" }); setResent(true); }}>Resend verification email</button>}
          </div>
        )}
        <TextField id="email" label="Email" type="email" autoComplete="email" required />
        <TextField id="password" label="Password" type="password" autoComplete="current-password" required />
        <div className="flex justify-end text-sm"><Link className="font-medium text-electric-600 hover:underline" href="/forgot-password">Forgot password?</Link></div>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</Button>
      </form>
    </AuthShell>
  );
}
