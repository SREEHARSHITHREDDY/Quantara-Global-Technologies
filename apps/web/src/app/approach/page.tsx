import type { Metadata } from "next";
import { approachSteps, company } from "@quantara/content";
import { Card, Section } from "@/components/ui/layout";
import { PageHero } from "@/components/site/page-hero";
import { ContactCta } from "@/components/site/contact-cta";

export const metadata: Metadata = { title: "Our Approach", description: "Quantara Technologies' five-step approach: discover, design, build, deploy, optimize." };

export default function ApproachPage() {
  return (
    <>
      <PageHero eyebrow="Our approach" title="From discovery to continuous optimization" description={company.supportingTagline} />
      <Section tone="mist">
        <ol className="space-y-6">
          {approachSteps.map((a) => (
            <li key={a.step}><Card className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <span className="font-display text-4xl font-semibold text-electric-600">0{a.step}</span>
              <div><h2 className="text-2xl font-semibold text-navy-900">{a.name}</h2><p className="mt-2 max-w-3xl leading-relaxed text-slate-600">{a.description}</p></div>
            </Card></li>
          ))}
        </ol>
      </Section>
      <ContactCta />
    </>
  );
}
