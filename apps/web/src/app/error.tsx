"use client";
import { Container } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="bg-white py-28"><Container className="max-w-xl text-center">
      <h1 className="text-4xl font-semibold text-navy-900">Something went wrong</h1>
      <p className="mt-4 text-slate-600">An unexpected error occurred. You can try again, and if it keeps happening, contact us.</p>
      <Button onClick={reset} className="mt-8">Try again</Button>
    </Container></section>
  );
}
