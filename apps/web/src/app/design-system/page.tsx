import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Card, Eyebrow, Section, SectionHeading } from "@/components/ui/layout";
import { Button, ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Design system", robots: { index: false, follow: false } };

// Internal reference page: hidden in production unless explicitly enabled.
export default function DesignSystem() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DESIGN_SYSTEM !== "1") notFound();
  const swatches = ["navy-950", "navy-900", "navy-700", "electric-600", "electric-400", "cyan-400", "mist-100", "mist-50"];
  return (
    <>
      <Section tone="dark"><SectionHeading tone="dark" eyebrow="Design system" title="Quantara visual language" description="Midnight navy, electric blue and cyan accents, spacious editorial layouts." /></Section>
      <Section>
        <Eyebrow>Colour</Eyebrow>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">{swatches.map((s) => <div key={s}><div className={`h-16 rounded-lg border border-mist-200 bg-${s}`} style={{ background: `var(--color-${s})` }} /><p className="mt-2 text-xs text-slate-600">{s}</p></div>)}</div>
        <Eyebrow className="mt-14">Buttons</Eyebrow>
        <div className="mt-6 flex flex-wrap gap-3"><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button><Button variant="ghost">Ghost</Button><ButtonLink href="/design-system">Link button</ButtonLink></div>
        <Eyebrow className="mt-14">Card</Eyebrow>
        <Card className="mt-6 max-w-md"><Badge>Capability</Badge><h3 className="mt-3 text-xl font-semibold text-navy-900">Service card</h3><p className="mt-2 text-slate-600">Structured, professional, restrained.</p></Card>
      </Section>
    </>
  );
}
