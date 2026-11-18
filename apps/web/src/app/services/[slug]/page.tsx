import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { services } from "@quantara/content";
import { Badge, Card, Section, SectionHeading } from "@/components/ui/layout";
import { PageHero } from "@/components/site/page-hero";
import { ContactCta } from "@/components/site/contact-cta";
import { getIndustry, getService } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export const generateStaticParams = () => services.map((s) => ({ slug: s.slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = getService((await params).slug);
  return s ? { title: s.title, description: s.summary } : {};
}

export default async function ServicePage({ params }: Props) {
  const s = getService((await params).slug);
  if (!s) notFound();
  const related = s.relatedServiceSlugs.map(getService).filter((x) => x !== undefined);
  const industries = s.relatedIndustrySlugs.map(getIndustry).filter((x) => x !== undefined);
  const list = "mt-8 grid gap-3 sm:grid-cols-2";
  return (
    <>
      <PageHero eyebrow="Service" title={s.title} description={s.summary} />
      <Section>
        <SectionHeading title="Introduction" description={s.introduction} />
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">{s.overview}</p>
      </Section>
      <Section tone="mist">
        <SectionHeading eyebrow="Capabilities" title="Relevant capabilities" />
        <ul className={list}>{s.capabilities.map((c) => <li key={c}><Card className="py-4 text-sm text-navy-800">{c}</Card></li>)}</ul>
      </Section>
      <Section>
        <SectionHeading eyebrow="Enterprise applications" title="Where this applies" description="Typical application scenarios for this service area." />
        <ul className={list}>{s.enterpriseApplications.map((c) => <li key={c}><Card className="py-4 text-sm text-slate-600">{c}</Card></li>)}</ul>
      </Section>
      <Section tone="mist">
        <SectionHeading eyebrow="Business challenges" title="Challenges this service addresses" />
        <ul className={list}>{s.businessChallenges.map((c) => <li key={c}><Card className="py-4 text-sm text-slate-600">{c}</Card></li>)}</ul>
      </Section>
      {industries.length > 0 && (
        <Section>
          <SectionHeading eyebrow="Related industries" title="Industries where this is relevant" />
          <ul className="mt-8 flex flex-wrap gap-3">{industries.map((i) => <li key={i.slug}><Link href={`/industries/${i.slug}`}><Badge className="px-4 py-2 text-sm hover:bg-mist-200">{i.title}</Badge></Link></li>)}</ul>
        </Section>
      )}
      {related.length > 0 && (
        <Section tone="mist">
          <SectionHeading eyebrow="Complementary services" title="Related services" />
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{related.map((r) => (
            <li key={r.slug}><Link href={`/services/${r.slug}`} className="block h-full"><Card className="h-full transition-shadow hover:shadow-lg"><h3 className="font-semibold text-navy-900">{r.title}</h3><p className="mt-2 text-sm text-slate-600">{r.summary}</p></Card></Link></li>
          ))}</ul>
        </Section>
      )}
      <ContactCta headline={`Discuss ${s.title}`} body="Tell us about your objectives and we will respond with how this service area can help." />
    </>
  );
}
