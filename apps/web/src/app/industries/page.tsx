import type { Metadata } from "next";
import Link from "next/link";
import { industries } from "@quantara/content";
import { Card, Section } from "@/components/ui/layout";
import { PageHero } from "@/components/site/page-hero";
import { ContactCta } from "@/components/site/contact-cta";

export const metadata: Metadata = { title: "Industries", description: "Industries served by Quantara Technologies and how its documented services apply to each." };

export default function IndustriesPage() {
  return (
    <>
      <PageHero eyebrow="Industries" title="Deep domain expertise across ten industries" description="How our documented services apply to the challenges of each sector." />
      <Section tone="mist">
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map((i) => (
            <li key={i.slug}><Link href={`/industries/${i.slug}`} className="group block h-full">
              <Card className="h-full transition-shadow group-hover:shadow-lg"><h2 className="text-lg font-semibold text-navy-900">{i.title}</h2><p className="mt-3 text-sm leading-relaxed text-slate-600">{i.summary}</p></Card>
            </Link></li>
          ))}
        </ul>
      </Section>
      <ContactCta />
    </>
  );
}
