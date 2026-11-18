"use client";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { FormError, FormNotice, MIN_PASSWORD, TextField, passwordProblem } from "./auth-ui";

const card = "rounded-[var(--radius-card)] border border-mist-200 bg-white p-6 shadow-[var(--shadow-card)]";
const secretOf = (uri: string) => new URL(uri).searchParams.get("secret") ?? "";

function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [enrol, setEnrol] = useState<{ uri: string; codes: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pw = (e: React.FormEvent<HTMLFormElement>) => String(new FormData(e.currentTarget).get("password") ?? "");

  async function start(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setPending(true);
    const { data, error: err } = await authClient.twoFactor.enable({ password: pw(e) });
    setPending(false);
    if (err || !data || data.method !== "totp") return setError("Could not start setup. Check your password and try again.");
    setEnrol({ uri: data.totpURI, codes: data.backupCodes });
  }
  async function confirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setPending(true);
    const code = String(new FormData(e.currentTarget).get("code") ?? "").replace(/\s/g, "");
    const { error: err } = await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (err) return setError("That code is not correct. Make sure your phone's clock is right and try the next code.");
    setEnrol(null); setNotice("Two-factor authentication is now on."); router.refresh();
  }
  async function disable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setPending(true);
    const { error: err } = await authClient.twoFactor.disable({ password: pw(e) });
    setPending(false);
    if (err) return setError("Could not turn off two-factor. Check your password.");
    setNotice("Two-factor authentication is now off."); router.refresh();
  }
  async function regenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setPending(true);
    const { data, error: err } = await authClient.twoFactor.generateBackupCodes({ password: pw(e) });
    setPending(false);
    if (err || !data) return setError("Could not create new backup codes. Check your password.");
    setEnrol({ uri: "", codes: data.backupCodes }); setNotice("New backup codes created. Your old codes no longer work.");
  }

  return (
    <div className={card}>
      <h2 className="text-lg font-semibold text-navy-900">Two-factor authentication</h2>
      <p className="mt-1 text-sm text-slate-600">{enabled ? "On. You will be asked for a code from your authenticator app each time you sign in." : "Off. Add a second step to protect your account with an authenticator app."}</p>
      <div className="mt-4 space-y-4">
        <FormError message={error} />
        {notice && <FormNotice>{notice}</FormNotice>}
        {enrol?.codes.length ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">Save these backup codes now. They are shown only once. Each works one time if you lose your phone.</p>
            <ul className="mt-3 grid grid-cols-2 gap-1 font-mono text-sm">{enrol.codes.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        ) : null}
        {enrol?.uri ? (
          <form onSubmit={confirm} className="space-y-4" noValidate>
            <p className="text-sm text-slate-700">Scan this QR code with an authenticator app (such as Google Authenticator, Microsoft Authenticator or 1Password), then enter the 6-digit code it shows.</p>
            <div className="inline-block rounded-lg border border-mist-200 bg-white p-3"><QRCodeSVG value={enrol.uri} size={168} /></div>
            <p className="text-xs text-slate-500">Can&apos;t scan? Enter this key manually: <span className="select-all font-mono">{secretOf(enrol.uri)}</span></p>
            <TextField id="code" label="Code from your app" inputMode="numeric" autoComplete="one-time-code" required />
            <Button type="submit" disabled={pending}>{pending ? "Checking..." : "Turn on two-factor"}</Button>
          </form>
        ) : enabled ? (
          <div className="space-y-6">
            <form onSubmit={regenerate} className="space-y-3" noValidate>
              <TextField id="password" label="Password" type="password" autoComplete="current-password" required hint="Confirm your password to create new backup codes." />
              <Button type="submit" variant="outline" disabled={pending}>New backup codes</Button>
            </form>
            <form onSubmit={disable} className="space-y-3 border-t border-mist-200 pt-6" noValidate>
              <TextField id="password" label="Password" type="password" autoComplete="current-password" required hint="Confirm your password to turn two-factor off." />
              <Button type="submit" variant="outline" disabled={pending}>Turn off two-factor</Button>
            </form>
          </div>
        ) : (
          <form onSubmit={start} className="space-y-3" noValidate>
            <TextField id="password" label="Password" type="password" autoComplete="current-password" required hint="Confirm your password to begin." />
            <Button type="submit" disabled={pending}>{pending ? "Starting..." : "Set up two-factor"}</Button>
          </form>
        )}
      </div>
    </div>
  );
}

function PasswordCard() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setDone(false);
    const form = e.currentTarget; const f = new FormData(form);
    const next = String(f.get("newPassword") ?? "");
    const problem = passwordProblem(next, String(f.get("confirm") ?? "")); if (problem) return setError(problem);
    setPending(true);
    const { error: err } = await authClient.changePassword({ currentPassword: String(f.get("currentPassword") ?? ""), newPassword: next, revokeOtherSessions: true });
    setPending(false);
    if (err) return setError("Could not change your password. Check your current password.");
    form.reset(); setDone(true);
  }
  return (
    <div className={card}>
      <h2 className="text-lg font-semibold text-navy-900">Change password</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        <FormError message={error} />
        {done && <FormNotice>Password changed. You were signed out of your other devices.</FormNotice>}
        <TextField id="currentPassword" label="Current password" type="password" autoComplete="current-password" required />
        <TextField id="newPassword" label="New password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} hint={`At least ${MIN_PASSWORD} characters.`} />
        <TextField id="confirm" label="Confirm new password" type="password" autoComplete="new-password" required />
        <Button type="submit" variant="outline" disabled={pending}>{pending ? "Saving..." : "Change password"}</Button>
      </form>
    </div>
  );
}

function SessionsCard() {
  const router = useRouter();
  const [done, setDone] = useState(false);
  return (
    <div className={card}>
      <h2 className="text-lg font-semibold text-navy-900">Devices</h2>
      <p className="mt-1 text-sm text-slate-600">Sign out everywhere except this device, for example if you used a shared computer.</p>
      {done && <div className="mt-3"><FormNotice>Other devices have been signed out.</FormNotice></div>}
      <Button className="mt-4" variant="outline" onClick={async () => { await authClient.revokeOtherSessions(); setDone(true); }}>Sign out other devices</Button>
      <Button className="mt-4 ml-3" variant="ghost" onClick={async () => { await authClient.signOut(); router.push("/"); router.refresh(); }}>Sign out</Button>
    </div>
  );
}

export function SecurityPanel({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  return <div className="space-y-6"><TwoFactorCard enabled={twoFactorEnabled} /><PasswordCard /><SessionsCard /></div>;
}
