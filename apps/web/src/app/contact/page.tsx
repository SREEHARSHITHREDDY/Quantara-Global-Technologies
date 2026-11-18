import type { Metadata } from "next";
import { Container } from "@/components/ui/layout";
import { PageHero } from "@/components/site/page-hero";
import { getSiteContact, telHref } from "@/lib/site-settings";
import { EnquiryForm } from "./enquiry-form";

export const metadata: Metadata = { title: "Contact", description: "Contact Quantara Technologies about AI, quantum, GCC, infrastructure and digital engineering initiatives." };

export default async function ContactPage() {
  const c = await getSiteContact();
  return (
    <>
      <PageHero eyebrow="Contact" title="Let's discuss your enterprise transformation" description="Tell us about your objectives. Our team will review your enquiry and respond." />
      <section className="bg-white py-16 sm:py-24">
        <Container className="max-w-3xl">
          {(c.email || c.phone || c.address) && (
            <address className="mb-10 rounded-[var(--radius-card)] border border-mist-200 bg-mist-50 p-6 text-sm not-italic text-slate-700">
              <p className="font-semibold text-navy-900">Prefer to write or call?</p>
              {c.email && <p className="mt-2"><a className="text-electric-600 underline" href={`mailto:${c.email}`}>{c.email}</a></p>}
              {c.phone && <p className="mt-1"><a className="text-electric-600 underline" href={telHref(c.phone)}>{c.phone}</a></p>}
              {c.address && <p className="mt-1 whitespace-pre-line">{c.address}</p>}
            </address>
          )}
          <EnquiryForm />
        </Container>
      </section>
    </>
  );
}
