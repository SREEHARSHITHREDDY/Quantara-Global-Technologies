import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { industries } from "@quantara/content";
import { Card, Section, SectionHeading } from "@/components/ui/layout";
import { PageHero } from "@/components/site/page-hero";
import { ContactCta } from "@/components/site/contact-cta";
import { getIndustry, getService } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export const generateStaticParams = () => industries.map((i) => ({ slug: i.slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const i = getIndustry((await params).slug);
  return i ? { title: i.title, description: i.summary } : {};
}

export default async function IndustryPage({ params }: Props) {
  const i = getIndustry((await params).slug);
  if (!i) notFound();
  const related = i.relatedServiceSlugs.map(getService).filter((x) => x !== undefined);
  return (
    <>
      <PageHero eyebrow="Industry" title={i.title} description={i.summary} />
      <Section><SectionHeading title="Overview" description={i.introduction} /></Section>
      <Section tone="mist">
        <SectionHeading eyebrow="Industry challenges" title="Challenges organizations in this sector face" />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">{i.challenges.map((c) => <li key={c}><Card className="py-4 text-sm text-slate-600">{c}</Card></li>)}</ul>
      </Section>
      <Section>
        <SectionHeading eyebrow="How we can help" title="Relevant Quantara services" />
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{related.map((s) => (
          <li key={s.slug}><Link href={`/services/${s.slug}`} className="block h-full"><Card className="h-full transition-shadow hover:shadow-lg"><h3 className="font-semibold text-navy-900">{s.title}</h3><p className="mt-2 text-sm text-slate-600">{s.summary}</p></Card></Link></li>
        ))}</ul>
      </Section>
      <ContactCta headline={`Talk to us about ${i.title}`} body="Tell us about your objectives and we will respond with how our services can help." />
    </>
  );
}
