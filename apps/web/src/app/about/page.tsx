import type { Metadata } from "next";
import { company, coreValues, whyQuantara } from "@quantara/content";
import { Card, Section, SectionHeading } from "@/components/ui/layout";
import { PageHero } from "@/components/site/page-hero";
import { ContactCta } from "@/components/site/contact-cta";

export const metadata: Metadata = { title: "About Us", description: company.about[0] };

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About us" title={company.aboutHeadline} description={company.supportingTagline} />
      <Section>
        <div className="grid gap-6 lg:grid-cols-3">{company.about.map((p) => <p key={p} className="text-lg leading-relaxed text-slate-600">{p}</p>)}</div>
      </Section>
      <Section tone="mist">
        <div className="grid gap-6 md:grid-cols-2">
          <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric-600">Vision</p><p className="mt-3 text-lg leading-relaxed text-navy-900">{company.vision}</p></Card>
          <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric-600">Mission</p><p className="mt-3 text-lg leading-relaxed text-navy-900">{company.mission}</p></Card>
        </div>
      </Section>
      <Section>
        <SectionHeading eyebrow="Core values" title="What guides our work" />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{coreValues.map((v) => <li key={v.name}><Card className="h-full"><h3 className="text-lg font-semibold text-navy-900">{v.name}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{v.description}</p></Card></li>)}</ul>
      </Section>
      <Section tone="mist">
        <SectionHeading eyebrow="Why Quantara Technologies" title="Built for sustained transformation" />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{whyQuantara.map((w) => <li key={w.name}><Card className="h-full"><h3 className="font-semibold text-navy-900">{w.name}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{w.description}</p></Card></li>)}</ul>
      </Section>
      <ContactCta />
    </>
  );
}
