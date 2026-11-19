import type { Metadata } from "next";
import Link from "next/link";
import { ContactCta } from "@/components/site/contact-cta";
import { PageHero } from "@/components/site/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Card, Section, SectionHeading } from "@/components/ui/layout";
import { EXECUTIVES, EXECUTIVE_GROUPS, PREVIEW_NOTICE, WHAT_YOU_RECEIVE } from "@/lib/executives";

export const metadata: Metadata = { title: "The Executive Council", description: "Ten AI executives, led by a CEO agent, assess a decision from every angle and report where they agree and where they do not." };

export default function ExecutivesPage() {
  return (
    <>
      <PageHero eyebrow="Executive AI Council" title="Ten executives. One considered answer." description="Bring a business decision to the council. Each executive assesses it from their own area, the CEO weighs the views, and disagreements are reported, never hidden." />
      <Section>
        <p role="note" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{PREVIEW_NOTICE}</p>
        {EXECUTIVE_GROUPS.map((g) => (
          <div key={g.id} className="mt-12">
            <SectionHeading eyebrow={g.title} title={g.summary} />
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {EXECUTIVES.filter((e) => e.group.id === g.id).map((e) => (
                <li key={e.code}>
                  <Link href={`/executives/${e.slug}`} className="block h-full">
                    <Card className="h-full transition-shadow hover:shadow-lg">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric-600">{e.code} · {e.title}</p>
                      <h3 className="mt-2 text-lg font-semibold text-navy-900">{e.tagline}</h3>
                      <p className="mt-2 text-sm text-slate-600">{e.mandate}</p>
                      <p className="mt-4 text-sm font-medium text-electric-600">Explore {e.code}</p>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>
      <Section tone="mist">
        <SectionHeading eyebrow="What you receive" title="Every assessment is structured and labelled" />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">{WHAT_YOU_RECEIVE.map((w) => <li key={w}><Card className="py-4 text-sm text-navy-800">{w}</Card></li>)}</ul>
        <p className="mt-6 max-w-3xl text-slate-600">Agents analyse and recommend. They never act on their own: payments, contracts, hiring and other sensitive actions are prepared for a person to approve.</p>
        <ButtonLink href="/council" size="lg" className="mt-8">Enter the Executive AI Council</ButtonLink>
      </Section>
      <ContactCta headline="Talk to us about the council" body="Access is enabled per workspace. Contact us to request a trial." />
    </>
  );
}
