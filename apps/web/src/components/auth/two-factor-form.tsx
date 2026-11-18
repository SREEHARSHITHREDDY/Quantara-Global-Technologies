"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { AuthShell, FormError, TextField } from "./auth-ui";

export function TwoFactorForm() {
  const router = useRouter();
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const code = String(new FormData(e.currentTarget).get("code") ?? "").replace(/\s/g, "");
    setPending(true);
    const { error: err } = backup ? await authClient.twoFactor.verifyBackupCode({ code }) : await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (err) return setError(err.status === 429 ? "Too many attempts. Please wait a minute." : "That code is not valid. Check it and try again, or go back and sign in again.");
    router.push("/account"); router.refresh();
  }
  return (
    <AuthShell title="Two-factor verification" subtitle={backup ? "Enter one of your saved backup codes. Each code works once." : "Enter the 6-digit code from your authenticator app."}
      footer={<Link className="font-medium text-electric-600 hover:underline" href="/sign-in">Back to sign in</Link>}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormError message={error} />
        <TextField id="code" label={backup ? "Backup code" : "Authenticator code"} inputMode={backup ? "text" : "numeric"} autoComplete="one-time-code" required autoFocus />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Verifying..." : "Verify"}</Button>
        <button type="button" className="block w-full text-center text-sm font-medium text-electric-600 hover:underline" onClick={() => { setBackup(!backup); setError(null); }}>
          {backup ? "Use my authenticator app instead" : "Use a backup code instead"}
        </button>
      </form>
    </AuthShell>
  );
}
