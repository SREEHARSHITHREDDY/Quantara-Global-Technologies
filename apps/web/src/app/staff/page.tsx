import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getAuth } from "@/lib/auth";

/** Private entrance for company personnel. Not linked from the public site and not indexed. The admin area still checks staff membership on every request. */
export const metadata: Metadata = { title: "Staff access", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function StaffEntrance() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (session) redirect("/admin"); // non-staff get a 404 there
  return <SignInForm variant="staff" />;
}
