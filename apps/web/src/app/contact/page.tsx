import type { Metadata } from "next";
import { Container } from "@/components/ui/layout";
import { PageHero } from "@/components/site/page-hero";
import { EnquiryForm } from "./enquiry-form";

export const metadata: Metadata = { title: "Contact", description: "Contact Quantara Technologies about AI, quantum, GCC, infrastructure and digital engineering initiatives." };

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Let's discuss your enterprise transformation" description="Tell us about your objectives. Our team will review your enquiry and respond." />
      <section className="bg-white py-16 sm:py-24">
        <Container className="max-w-3xl"><EnquiryForm /></Container>
      </section>
    </>
  );
}
