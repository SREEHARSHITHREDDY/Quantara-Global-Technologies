import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPrisma, unsubscribeNewsletter } from "@quantara/db";
import { Container } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };
export const dynamic = "force-dynamic";

async function unsubscribe(formData: FormData) {
  "use server";
  const r = await unsubscribeNewsletter(getPrisma(), String(formData.get("token") ?? ""));
  redirect(`/newsletter/unsubscribe?done=${r.ok ? "ok" : "invalid"}`);
}

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const { token, done } = await searchParams;
  const msg = done === "ok" ? "You have been unsubscribed. You will not receive further updates." : done === "invalid" ? "This link is not valid." : null;
  return (
    <section className="bg-white py-24"><Container className="max-w-xl">
      <h1 className="text-3xl font-semibold text-navy-900">Unsubscribe</h1>
      {msg ? <p role="status" className="mt-6 text-slate-700">{msg}</p>
        : token ? <form action={unsubscribe} className="mt-6"><input type="hidden" name="token" value={token} /><Button type="submit">Unsubscribe me</Button></form>
        : <p className="mt-6 text-slate-700">This link is missing its token. Please use the link from your email.</p>}
    </Container></section>
  );
}
