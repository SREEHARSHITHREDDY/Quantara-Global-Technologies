import Link from "next/link";
import { ArrowUpRight, Atom, Brain, Building2, Server } from "lucide-react";
import { approachSteps, company, industries, services, whyQuantara } from "@quantara/content";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section, SectionHeading } from "@/components/ui/layout";
import { ContactCta } from "@/components/site/contact-cta";
import { CouncilOrbit } from "@/components/site/council-orbit";
import { HeroHeading } from "@/components/site/hero-heading";
import { Marquee } from "@/components/site/marquee";
import { ApproachTimeline } from "@/components/motion/approach-timeline";
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { requireService } from "@/lib/content";
import { EXECUTIVES, EXECUTIVE_GROUPS } from "@/lib/executives";
import { COUNCIL_HREF, isLive } from "@/lib/routes";

// Homepage sections: nav (layout) · hero · positioning · about · core capabilities · featured services ·
// AI showcase · quantum showcase · GCC & infrastructure · industries · approach · why Quantara ·
// latest insights (renders only when published insights exist; none yet) · Council intro (only when the
// Council route is live) · contact CTA (only when /contact is live).
const CORE_SLUGS = ["artificial-intelligence", "quantum-computing", "gcc-advisory", "datacenter-infrastructure"] as const;
const CORE_ICONS = [Brain, Atom, Building2, Server] as const;

function CapabilityList({ slug, limit }: { slug: string; limit?: number }) {
  const s = requireService(slug);
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
      {s.capabilities.slice(0, limit).map((c, i) => (
        <li key={c}><Reveal delay={(i % 2) * 0.06} y={14}><div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-mist-100 transition-colors hover:border-cyan-400/40 hover:bg-white/10">{c}</div></Reveal></li>
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
        <Container className="grid items-center gap-12 py-20 sm:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:py-36">
          <div>
            <p className="text-shimmer animate-rise text-sm font-semibold uppercase tracking-[0.2em]">{company.name}</p>
            <HeroHeading text={company.tagline} className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.05] sm:text-6xl lg:text-[4.25rem]" />
            <p className="animate-rise mt-6 max-w-2xl text-lg text-mist-200" style={{ animationDelay: "500ms" }}>{company.supportingTagline}</p>
            <div className="animate-rise mt-10 flex flex-wrap gap-3" style={{ animationDelay: "650ms" }}>
              <ButtonLink href="/services" size="lg">Explore what we do</ButtonLink>
              <ButtonLink href="/industries" size="lg" variant="outline-dark">Industries we serve</ButtonLink>
            </div>
          </div>
          {isLive("/executives") && <div className="animate-rise" style={{ animationDelay: "400ms" }}><CouncilOrbit codes={EXECUTIVES.filter((e) => e.code !== "CEO").map((e) => e.code)} /></div>}
        </Container>
      </div>

      <Container className="relative z-10 -mt-8 sm:-mt-10">
        <Reveal>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-mist-200 bg-mist-200 shadow-[0_24px_60px_-24px_rgb(10_22_48/0.35)] md:grid-cols-4">
            {[
              { n: services.length, label: "Service areas" },
              { n: industries.length, label: "Industries served" },
              ...(isLive("/executives") ? [{ n: EXECUTIVES.length, label: "AI executives on the council" }] : []),
              { n: approachSteps.length, label: "Steps in our approach" },
            ].map((x) => (
              <div key={x.label} className="bg-white px-6 py-7 text-center">
                <dd className="font-display text-4xl font-semibold text-navy-900 sm:text-5xl"><CountUp value={x.n} /></dd>
                <dt className="mt-1 text-sm text-slate-600">{x.label}</dt>
              </div>
            ))}
          </dl>
        </Reveal>
      </Container>

      <Section tone="light">
        <SectionHeading eyebrow="Positioning" title="Where AI, quantum and intelligent infrastructure converge" description={company.about[0]} />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Reveal className="h-full"><SpotlightCard className="h-full"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric-600">Our vision</p><p className="mt-3 leading-relaxed text-slate-600">{company.vision}</p></SpotlightCard></Reveal>
          <Reveal delay={0.1} className="h-full"><SpotlightCard className="h-full"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric-600">Our mission</p><p className="mt-3 leading-relaxed text-slate-600">{company.mission}</p></SpotlightCard></Reveal>
        </div>
      </Section>

      <Section tone="mist">
        <SectionHeading eyebrow="About Quantara" title={company.aboutHeadline} />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {company.about.slice(1).map((p, i) => <Reveal key={p} delay={i * 0.1}><p className="text-lg leading-relaxed text-slate-600">{p}</p></Reveal>)}
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Core technology capabilities" title="Four areas of focus" />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {company.focusAreas.map((area, i) => {
            const Icon = CORE_ICONS[i] ?? Brain;
            return (
              <li key={area}><Reveal delay={i * 0.08} className="h-full"><SpotlightCard className="h-full">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-electric-600 to-cyan-500 text-white shadow-lg shadow-electric-600/25"><Icon aria-hidden className="h-5 w-5" /></span>
                <span className="mt-5 block text-sm font-semibold text-electric-600">0{i + 1}</span>
                <h3 className="mt-1 text-xl font-semibold text-navy-900">{area}</h3>
                <Link href={`/services/${CORE_SLUGS[i] ?? "artificial-intelligence"}`} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-electric-600 hover:underline">Learn more <ArrowUpRight aria-hidden className="h-4 w-4" /></Link>
              </SpotlightCard></Reveal></li>
            );
          })}
        </ul>
      </Section>

      <Section tone="mist">
        <SectionHeading eyebrow="Featured services" title="What we do" description="Nine service areas, from strategy and engineering to secure operation." />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => (
            <li key={s.slug}><Reveal delay={(i % 3) * 0.08} className="h-full"><Link href={`/services/${s.slug}`} className="group block h-full">
              <SpotlightCard className="h-full">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-navy-900">{s.title}</h3>
                  <ArrowUpRight aria-hidden className="mt-1 h-5 w-5 shrink-0 text-slate-400 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-electric-600" />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{s.summary}</p>
              </SpotlightCard>
            </Link></Reveal></li>
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
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">{quantum.capabilities.map((c, i) => <li key={c}><Reveal delay={(i % 2) * 0.06} y={14}><div className="rounded-lg border border-mist-200 bg-mist-50 px-4 py-3 text-sm text-navy-800 transition-colors hover:border-electric-500/40 hover:bg-white">{c}</div></Reveal></li>)}</ul>
        <ButtonLink href={`/services/${quantum.slug}`} variant="outline" className="mt-8">Explore quantum services</ButtonLink>
      </Section>

      <Section tone="mist">
        <SectionHeading eyebrow="GCC and infrastructure" title="Global Capability Centers and datacenter infrastructure" description={`${gcc.introduction} ${dc.introduction}`} />
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {[gcc, dc].map((s, i) => (
            <Reveal key={s.slug} delay={i * 0.1} className="h-full"><SpotlightCard className="h-full">
              <h3 className="text-xl font-semibold text-navy-900">{s.title}</h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">{s.capabilities.map((c) => <li key={c}>• {c}</li>)}</ul>
              <Link href={`/services/${s.slug}`} className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-electric-600 hover:underline">View service <ArrowUpRight aria-hidden className="h-4 w-4" /></Link>
            </SpotlightCard></Reveal>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Industry expertise" title="Ten industries we serve" />
        <div className="mt-10 space-y-3">
          <Marquee items={industries.slice(0, Math.ceil(industries.length / 2)).map((i) => ({ href: `/industries/${i.slug}`, label: i.title }))} speed={55} />
          <Marquee reverse items={industries.slice(Math.ceil(industries.length / 2)).map((i) => ({ href: `/industries/${i.slug}`, label: i.title }))} speed={65} />
        </div>
      </Section>

      <Section tone="mist">
        <SectionHeading eyebrow="Our approach" title="Discover, design, build, deploy, optimize" />
        <ApproachTimeline steps={approachSteps.map((a) => ({ step: a.step, name: a.name, description: a.description }))} />
      </Section>

      <Section>
        <SectionHeading eyebrow="Why Quantara Technologies" title="Built for sustained transformation" />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {whyQuantara.map((w, i) => (
            <li key={w.name}><Reveal delay={i * 0.08} className="h-full"><SpotlightCard className="h-full"><h3 className="font-semibold text-navy-900">{w.name}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{w.description}</p></SpotlightCard></Reveal></li>
          ))}
        </ul>
      </Section>

      {isLive("/executives") && (
        <Section tone="dark">
          <SectionHeading tone="dark" eyebrow="Executive AI Council" title="A council of AI executives, led by a CEO agent" description="Ten executives assess a decision from their own area. The CEO weighs the views and reports where they disagree." />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {EXECUTIVE_GROUPS.map((g, gi) => (
              <Reveal key={g.id} delay={gi * 0.08} className="h-full"><SpotlightCard dark className="h-full">
                <h3 className="text-lg font-semibold text-white">{g.title}</h3>
                <p className="mt-1 text-sm text-mist-300">{g.summary}</p>
                <ul className="mt-4 space-y-3">
                  {EXECUTIVES.filter((e) => e.group.id === g.id).map((e) => (
                    <li key={e.code}><Link href={`/executives/${e.slug}`} className="block text-sm text-mist-100 hover:text-white"><span className="font-semibold text-cyan-400">{e.code}</span> {e.tagline}</Link></li>
                  ))}
                </ul>
              </SpotlightCard></Reveal>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-4">
            <ButtonLink href="/executives" size="lg">Meet the executives</ButtonLink>
            {isLive(COUNCIL_HREF) && <ButtonLink href={COUNCIL_HREF} size="lg" variant="outline-dark">Enter the Executive AI Council</ButtonLink>}
          </div>
        </Section>
      )}

      <ContactCta />
    </>
  );
}
