import type { Metadata } from "next";
import Link from "next/link";
import { employmentLabel, getPrisma, listOpenJobs, type PublicJob } from "@quantara/db";
import { PageHero } from "@/components/site/page-hero";
import { Container } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Careers", description: "Open roles at Quantara Technologies." };
export const dynamic = "force-dynamic";

export default async function CareersPage() {
  let jobs: PublicJob[] = []; let failed = false;
  try { jobs = await listOpenJobs(getPrisma()); } catch { failed = true; }
  return (
    <>
      <PageHero eyebrow="Careers" title="Build intelligent enterprises with us" description="Join a team working on AI, quantum, cloud and digital engineering for large organisations." />
      <section className="bg-white py-16 sm:py-24">
        <Container className="max-w-3xl">
          {failed && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">We could not load open roles right now. Please try again shortly.</p>}
          {!failed && jobs.length === 0 && <p className="text-slate-600">There are no open roles at the moment. Please check back soon.</p>}
          <ul className="space-y-4">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link href={`/careers/${j.slug}`} className="block rounded-[var(--radius-card)] border border-mist-200 bg-white p-6 shadow-[var(--shadow-card)] transition hover:border-electric-500">
                  <h2 className="text-xl font-semibold text-navy-900">{j.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{j.department} · {j.location} · {employmentLabel(j.employmentType)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </>
  );
}
