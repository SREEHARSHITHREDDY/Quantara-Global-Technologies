"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

/** Client-side so the public pages stay statically rendered. Shows Account when signed in (plus Admin for staff), otherwise Sign in. */
export function AuthNav({ className }: { className?: string }) {
  const { data, isPending } = authClient.useSession();
  const [isStaff, setIsStaff] = useState(false);
  const userId = data?.user.id;
  useEffect(() => {
    if (!userId) { setIsStaff(false); return; }
    let live = true;
    fetch("/api/me/staff", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { isStaff: false })).then((j: { isStaff?: boolean }) => { if (live) setIsStaff(!!j.isStaff); }).catch(() => {});
    return () => { live = false; };
  }, [userId]);
  if (isPending) return <span className={className} aria-hidden="true">&nbsp;</span>;
  if (!data) return <Link href="/sign-in" className={className}>Sign in</Link>;
  return (
    <>
      {isStaff && <Link href="/admin" className={className}>Admin</Link>}
      <Link href="/council" className={className}>Council</Link>
      <Link href="/account" className={className}>Account</Link>
    </>
  );
}
