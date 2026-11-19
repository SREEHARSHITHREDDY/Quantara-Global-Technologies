import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactCta } from "@/components/site/contact-cta";
import { PageHero } from "@/components/site/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, Section, SectionHeading } from "@/components/ui/layout";
import { EXECUTIVES, PREVIEW_NOTICE, WHAT_YOU_RECEIVE, getExecutive } from "@/lib/executives";

type Props = { params: Promise<{ code: string }> };
export const dynamicParams = false;
export const generateStaticParams = () => EXECUTIVES.map((e) => ({ code: e.slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = getExecutive((await params).code);
  return e ? { title: `${e.name} agent`, description: `${e.tagline} ${e.mandate}` } : {};
}

export default async function ExecutivePage({ params }: Props) {
  const e = getExecutive((await params).code);
  if (!e) notFound();
  const peers = EXECUTIVES.filter((x) => x.group.id === e.group.id && x.code !== e.code);
  return (
    <>
      <PageHero eyebrow={`${e.code} · ${e.title}`} title={e.tagline} description={e.mandate} />
      <Section>
        <p role="note" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{PREVIEW_NOTICE}</p>
        <SectionHeading eyebrow="Focus" title={`Where the ${e.name} looks`} className="mt-12" />
        <ul className="mt-6 flex flex-wrap gap-3">{e.focus.map((f) => <li key={f}><Badge className="px-4 py-2 text-sm">{f}</Badge></li>)}</ul>
      </Section>
      <Section tone="mist">
        <SectionHeading eyebrow="Questions asked" title="What this executive asks of every proposal" />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">{e.lenses.map((l) => <li key={l}><Card className="py-4 text-sm text-navy-800">{l}</Card></li>)}</ul>
      </Section>
      <Section>
        <SectionHeading eyebrow="What you receive" title="A structured, labelled assessment" />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">{WHAT_YOU_RECEIVE.map((w) => <li key={w}><Card className="py-4 text-sm text-slate-600">{w}</Card></li>)}</ul>
      </Section>
      {peers.length > 0 && (
        <Section tone="mist">
          <SectionHeading eyebrow={e.group.title} title="Works alongside" />
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{peers.map((p) => (
            <li key={p.code}><Link href={`/executives/${p.slug}`} className="block h-full"><Card className="h-full transition-shadow hover:shadow-lg"><h3 className="font-semibold text-navy-900">{p.name}</h3><p className="mt-2 text-sm text-slate-600">{p.tagline}</p></Card></Link></li>
          ))}</ul>
          <ButtonLink href="/executives" className="mt-8">See all ten executives</ButtonLink>
        </Section>
      )}
      <ContactCta headline={`Consult the ${e.name} agent`} body="Access is enabled per workspace. Contact us to request a trial." />
    </>
  );
}
