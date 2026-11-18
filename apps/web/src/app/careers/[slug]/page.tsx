import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { employmentLabel, getOpenJob, getPrisma } from "@quantara/db";
import { PageHero } from "@/components/site/page-hero";
import { Container } from "@/components/ui/layout";
import { ApplyForm } from "./apply-form";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const job = await getOpenJob(getPrisma(), slug).catch(() => null);
  return job ? { title: job.title, description: job.description.slice(0, 160) } : { title: "Careers" };
}

export default async function JobPage({ params }: Props) {
  const { slug } = await params;
  const job = await getOpenJob(getPrisma(), slug);
  if (!job) notFound();
  const List = ({ title, items }: { title: string; items: string[] }) => items.length === 0 ? null : (
    <div className="mt-8"><h2 className="text-lg font-semibold text-navy-900">{title}</h2><ul className="mt-3 list-disc space-y-1.5 pl-5 text-slate-700">{items.map((i) => <li key={i}>{i}</li>)}</ul></div>
  );
  return (
    <>
      <PageHero eyebrow="Careers" title={job.title} description={`${job.department} · ${job.location} · ${employmentLabel(job.employmentType)}`} />
      <section className="bg-white py-16 sm:py-24">
        <Container className="max-w-3xl">
          <Link href="/careers" className="text-sm text-electric-600 underline">← All open roles</Link>
          <p className="mt-6 whitespace-pre-line leading-relaxed text-slate-700">{job.description}</p>
          <List title="Responsibilities" items={job.responsibilities} />
          <List title="Requirements" items={job.requirements} />
          <div className="mt-12 border-t border-mist-200 pt-10">
            <h2 className="text-2xl font-semibold text-navy-900">Apply for this role</h2>
            <div className="mt-6"><ApplyForm jobId={job.id} /></div>
          </div>
        </Container>
      </section>
    </>
  );
}
