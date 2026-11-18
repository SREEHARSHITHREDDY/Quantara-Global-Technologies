import { Container } from "@/components/ui/layout";
import { PageHero } from "@/components/site/page-hero";

export interface LegalSection { heading: string; body: string[] }

export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: LegalSection[] }) {
  return (
    <>
      <PageHero eyebrow="Legal" title={title} description={`Last updated ${updated}`} />
      <section className="bg-white py-16 sm:py-20">
        <Container className="max-w-3xl">
          <p className="text-lg leading-relaxed text-slate-600">{intro}</p>
          {sections.map((s) => (
            <div key={s.heading} className="mt-10">
              <h2 className="text-2xl font-semibold text-navy-900">{s.heading}</h2>
              {s.body.map((p) => <p key={p} className="mt-3 leading-relaxed text-slate-600">{p}</p>)}
            </div>
          ))}
        </Container>
      </section>
    </>
  );
}
