import Link from "next/link";
import { approachSteps, company, industries, services, whyQuantara } from "@quantara/content";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, Container, Section, SectionHeading } from "@/components/ui/layout";
import { ContactCta } from "@/components/site/contact-cta";
import { requireService } from "@/lib/content";
import { COUNCIL_HREF, isLive } from "@/lib/routes";

// Homepage sections: nav (layout) · hero · positioning · about · core capabilities · featured services ·
// AI showcase · quantum showcase · GCC & infrastructure · industries · approach · why Quantara ·
// latest insights (renders only when published insights exist; none yet) · Council intro (only when the
// Council route is live) · contact CTA (only when /contact is live).
const CORE_SLUGS = ["artificial-intelligence", "quantum-computing", "gcc-advisory", "datacenter-infrastructure"] as const;

function CapabilityList({ slug, limit }: { slug: string; limit?: number }) {
  const s = requireService(slug);
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
      {s.capabilities.slice(0, limit).map((c) => (
        <li key={c} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-mist-100">{c}</li>
      ))}
    </ul>
  );
}

export default function HomePage() {
  const ai = requireService("artificial-intelligence");
  const quantum = requireService("quantum-computing");
  const gcc = requireService("gcc-advisory");
  const dc = requireService("datacenter-infrastructure");
  return (
    <>
      <div className="bg-hero text-white">
        <Container className="py-24 sm:py-32 lg:py-40">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">{company.name}</p>
          <h1 className="animate-rise mt-6 max-w-4xl text-4xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl">{company.tagline}</h1>
          <p className="mt-6 max-w-2xl text-lg text-mist-200">{company.supportingTagline}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/services" size="lg">Explore what we do</ButtonLink>
            <ButtonLink href="/industries" size="lg" variant="outline-dark">Industries we serve</ButtonLink>
          </div>
        </Container>
      </div>

      <Section tone="light">
        <SectionHeading eyebrow="Positioning" title="Where AI, quantum and intelligent infrastructure converge" description={company.about[0]} />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric-600">Our vision</p><p className="mt-3 leading-relaxed text-slate-600">{company.vision}</p></Card>
          <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric-600">Our mission</p><p className="mt-3 leading-relaxed text-slate-600">{company.mission}</p></Card>
        </div>
      </Section>

      <Section tone="mist">
        <SectionHeading eyebrow="About Quantara" title={company.aboutHeadline} />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {company.about.slice(1).map((p) => <p key={p} className="text-lg leading-relaxed text-slate-600">{p}</p>)}
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Core technology capabilities" title="Four areas of focus" />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {company.focusAreas.map((area, i) => (
            <li key={area}><Card className="h-full">
              <span className="text-sm font-semibold text-electric-600">0{i + 1}</span>
              <h3 className="mt-3 text-xl font-semibold text-navy-900">{area}</h3>
              <Link href={`/services/${CORE_SLUGS[i] ?? "artificial-intelligence"}`} className="mt-4 inline-block text-sm font-medium text-electric-600 hover:underline">Learn more</Link>
            </Card></li>
          ))}
        </ul>
      </Section>

      <Section tone="mist">
        <SectionHeading eyebrow="Featured services" title="What we do" description="Nine service areas, from strategy and engineering to secure operation." />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li key={s.slug}><Link href={`/services/${s.slug}`} className="group block h-full">
              <Card className="h-full transition-shadow group-hover:shadow-lg">
                <h3 className="text-lg font-semibold text-navy-900">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{s.summary}</p>
              </Card>
            </Link></li>
          ))}
        </ul>
      </Section>

      <Section tone="dark">
        <SectionHeading tone="dark" eyebrow="AI and Agentic AI" title={ai.title} description={ai.introduction} />
        <CapabilityList slug={ai.slug} />
        <ButtonLink href={`/services/${ai.slug}`} variant="outline-dark" className="mt-8">Explore AI services</ButtonLink>
      </Section>

      <Section tone="light">
        <SectionHeading eyebrow="Quantum technology" title={quantum.title} description={quantum.introduction} />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">{quantum.capabilities.map((c) => <li key={c} className="rounded-lg border border-mist-200 bg-mist-50 px-4 py-3 text-sm text-navy-800">{c}</li>)}</ul>
        <ButtonLink href={`/services/${quantum.slug}`} variant="outline" className="mt-8">Explore quantum services</ButtonLink>
      </Section>

      <Section tone="mist">
        <SectionHeading eyebrow="GCC and infrastructure" title="Global Capability Centers and datacenter infrastructure" description={`${gcc.introduction} ${dc.introduction}`} />
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {[gcc, dc].map((s) => (
            <Card key={s.slug}>
              <h3 className="text-xl font-semibold text-navy-900">{s.title}</h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">{s.capabilities.map((c) => <li key={c}>• {c}</li>)}</ul>
              <Link href={`/services/${s.slug}`} className="mt-5 inline-block text-sm font-medium text-electric-600 hover:underline">View service</Link>
            </Card>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Industry expertise" title="Ten industries we serve" />
        <ul className="mt-10 flex flex-wrap gap-3">
          {industries.map((i) => <li key={i.slug}><Link href={`/industries/${i.slug}`}><Badge className="px-4 py-2 text-sm hover:bg-mist-200">{i.title}</Badge></Link></li>)}
        </ul>
      </Section>

      <Section tone="mist">
        <SectionHeading eyebrow="Our approach" title="Discover, design, build, deploy, optimize" />
        <ol className="mt-12 grid gap-6 md:grid-cols-5">
          {approachSteps.map((a) => (
            <li key={a.step}><Card className="h-full">
              <span className="text-sm font-semibold text-electric-600">Step {a.step}</span>
              <h3 className="mt-2 text-lg font-semibold text-navy-900">{a.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{a.description}</p>
            </Card></li>
          ))}
        </ol>
      </Section>

      <Section>
        <SectionHeading eyebrow="Why Quantara Technologies" title="Built for sustained transformation" />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {whyQuantara.map((w) => (
            <li key={w.name}><Card className="h-full"><h3 className="font-semibold text-navy-900">{w.name}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{w.description}</p></Card></li>
          ))}
        </ul>
      </Section>

      {isLive(COUNCIL_HREF) && (
        <Section tone="dark">
          <SectionHeading tone="dark" eyebrow="Executive AI Council" title="A council of AI executives, led by a CEO agent" />
          <ButtonLink href={COUNCIL_HREF} size="lg" className="mt-8">Enter the Executive AI Council</ButtonLink>
        </Section>
      )}

      <ContactCta />
    </>
  );
}
