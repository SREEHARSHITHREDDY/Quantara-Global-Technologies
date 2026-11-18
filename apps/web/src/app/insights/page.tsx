import type { Metadata } from "next";
import Link from "next/link";
import { getPrisma, listInsightCategories, listPublishedInsights } from "@quantara/db";
import { PageHero } from "@/components/site/page-hero";
import { Container } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Insights", description: "Perspectives on AI, quantum computing, cloud, data and enterprise transformation from Quantara Technologies." };
export const dynamic = "force-dynamic";
const fmt = (d: Date | null) => d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ category?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(parseInt(sp.page ?? "1", 10) || 1, 1);
  let data: Awaited<ReturnType<typeof listPublishedInsights>> | null = null; let cats: { slug: string; name: string }[] = [];
  try { const db = getPrisma(); [data, cats] = await Promise.all([listPublishedInsights(db, { categorySlug: sp.category, page }), listInsightCategories(db)]); } catch { /* shown below */ }
  const href = (p: number) => `/insights?${new URLSearchParams({ ...(sp.category ? { category: sp.category } : {}), page: String(p) })}`;
  const pill = (on: boolean) => `rounded-full border px-3 py-1 text-sm ${on ? "border-navy-900 bg-navy-900 text-white" : "border-mist-200 bg-white text-slate-700"}`;
  return (
    <>
      <PageHero eyebrow="Insights" title="Perspectives for the intelligent enterprise" description="Our thinking on AI, quantum computing, cloud, data and enterprise transformation." />
      <section className="bg-white py-16 sm:py-24">
        <Container className="max-w-4xl">
          {!data && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">We could not load articles right now. Please try again shortly.</p>}
          {cats.length > 0 && <nav aria-label="Categories" className="mb-8 flex flex-wrap gap-2"><Link href="/insights" className={pill(!sp.category)}>All</Link>{cats.map((c) => <Link key={c.slug} href={`/insights?category=${c.slug}`} className={pill(sp.category === c.slug)}>{c.name}</Link>)}</nav>}
          {data && data.items.length === 0 && <p className="text-slate-600">No articles yet. Please check back soon.</p>}
          <ul className="space-y-6">
            {data?.items.map((a) => (
              <li key={a.id}>
                <Link href={`/insights/${a.slug}`} className="block rounded-[var(--radius-card)] border border-mist-200 bg-white p-6 shadow-[var(--shadow-card)] transition hover:border-electric-500">
                  <p className="text-xs font-semibold uppercase tracking-wider text-electric-600">{a.category?.name ?? "Insight"} · {fmt(a.publishedAt)}</p>
                  <h2 className="mt-2 text-xl font-semibold text-navy-900">{a.title}</h2>
                  <p className="mt-2 text-slate-600">{a.excerpt}</p>
                </Link>
              </li>
            ))}
          </ul>
          {data && data.pages > 1 && <div className="mt-8 flex items-center gap-4 text-sm">{data.page > 1 && <Link className="underline" href={href(data.page - 1)}>Previous</Link>}<span>Page {data.page} of {data.pages}</span>{data.page < data.pages && <Link className="underline" href={href(data.page + 1)}>Next</Link>}</div>}
        </Container>
      </section>
    </>
  );
}
