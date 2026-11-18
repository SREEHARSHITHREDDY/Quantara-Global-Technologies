import type { Metadata } from "next";
import Link from "next/link";
import { services } from "@quantara/content";
import { Card, Section } from "@/components/ui/layout";
import { PageHero } from "@/components/site/page-hero";
import { ContactCta } from "@/components/site/contact-cta";

export const metadata: Metadata = { title: "What We Do", description: "Quantara Technologies services across AI, quantum computing, GCC advisory, infrastructure, cloud, data, engineering, enterprise applications and cybersecurity." };

export default function ServicesPage() {
  return (
    <>
      <PageHero eyebrow="What we do" title="Services across the AI and quantum era" description="Nine service areas that take enterprises from strategy through engineering to secure operation." />
      <Section tone="mist">
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li key={s.slug}><Link href={`/services/${s.slug}`} className="group block h-full">
              <Card className="h-full transition-shadow group-hover:shadow-lg">
                <h2 className="text-lg font-semibold text-navy-900">{s.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{s.summary}</p>
                <p className="mt-4 text-sm font-medium text-electric-600">{s.capabilities.length} capabilities</p>
              </Card>
            </Link></li>
          ))}
        </ul>
      </Section>
      <ContactCta />
    </>
  );
}
