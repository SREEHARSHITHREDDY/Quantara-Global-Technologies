import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPrisma, confirmNewsletter } from "@quantara/db";
import { buildMailer } from "@/lib/auth";
import { Container } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import { welcomeEmail } from "@/server/newsletter-service";
import { siteBase } from "@/lib/seo";

export const metadata: Metadata = { title: "Confirm subscription", robots: { index: false } };
export const dynamic = "force-dynamic";

async function confirm(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const r = await confirmNewsletter(getPrisma(), token);
  if (r.ok) { try { await buildMailer().send({ to: r.email, ...welcomeEmail(siteBase(), r.unsubscribeToken) }); } catch { /* the subscription is confirmed even if the welcome email fails */ } }
  redirect(`/newsletter/confirm?done=${r.ok ? "ok" : r.reason}`);
}

// Confirming needs a button press (a POST), so mail scanners that open links cannot confirm for the reader.
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const { token, done } = await searchParams;
  const msg = done === "ok" ? "You are subscribed. Thank you." : done === "expired" ? "This link has expired. Please subscribe again from the footer of our site." : done === "invalid" ? "This link is not valid or has already been used." : null;
  return (
    <section className="bg-white py-24"><Container className="max-w-xl">
      <h1 className="text-3xl font-semibold text-navy-900">Confirm your subscription</h1>
      {msg ? <p role="status" className="mt-6 text-slate-700">{msg}</p>
        : token ? <form action={confirm} className="mt-6"><input type="hidden" name="token" value={token} /><Button type="submit">Confirm subscription</Button></form>
        : <p className="mt-6 text-slate-700">This link is missing its token. Please use the link from your email.</p>}
    </Container></section>
  );
}
