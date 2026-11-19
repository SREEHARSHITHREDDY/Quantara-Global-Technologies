"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { subscribe } from "@/app/newsletter/actions";
import type { NewsletterState } from "@/server/newsletter-service";

export function NewsletterForm() {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribe, { status: "idle" });
  if (state.status === "sent") {
    return <p role="status" className="mt-3 text-sm text-mist-300">Check your inbox. If this address can be subscribed, we have sent a link to confirm it.</p>;
  }
  return (
    <form action={action} className="mt-3 max-w-xs space-y-2" noValidate>
      <label htmlFor="nl-email" className="sr-only">Email address</label>
      <input id="nl-email" name="email" type="email" autoComplete="email" required placeholder="you@company.com"
        className="block w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-mist-400 focus:border-cyan-400 focus:outline-none" />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className="flex items-start gap-2 text-xs text-mist-300">
        <input type="checkbox" name="consent" className="mt-0.5" required />
        <span>I agree to receive occasional updates from Quantara Technologies and can unsubscribe at any time.</span>
      </label>
      {state.status === "error" && <p role="alert" className="text-xs text-red-300">{state.message}</p>}
      <Button type="submit" size="sm" variant="outline-dark" disabled={pending}>{pending ? "Sending…" : "Subscribe"}</Button>
    </form>
  );
}
