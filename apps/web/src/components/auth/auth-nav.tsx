"use client";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

/** Client-side so the public pages stay statically rendered. Shows Account when signed in, otherwise Sign in. */
export function AuthNav({ className }: { className?: string }) {
  const { data, isPending } = authClient.useSession();
  if (isPending) return <span className={className} aria-hidden="true">&nbsp;</span>;
  return data ? <Link href="/account" className={className}>Account</Link> : <Link href="/sign-in" className={className}>Sign in</Link>;
}
