"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/** Client-side so the public pages stay statically rendered. Signed out: Sign in. Signed in: Account and Sign out. Staff reach the admin area through their own entrance, never from here. */
export function AuthNav({ className }: { className?: string }) {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  if (isPending) return <span className={className} aria-hidden="true">&nbsp;</span>;
  if (!data) return <Link href="/sign-in" className={className}>Sign in</Link>;
  return (
    <>
      <Link href="/account" className={className}>Account</Link>
      <button type="button" className={className} onClick={async () => { await authClient.signOut(); router.push("/"); router.refresh(); }}>Sign out</button>
    </>
  );
}
