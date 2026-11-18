import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrisma, getPublishedInsight } from "@quantara/db";
import { company } from "@quantara/content";
import { ArticleBody } from "@/components/site/article-body";
import { PageHero } from "@/components/site/page-hero";
import { Container } from "@/components/ui/layout";
import { readingMinutes } from "@/lib/markdown";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
const fmt = (d: Date | null) => d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublishedInsight(getPrisma(), slug).catch(() => null);
  if (!a) return { title: "Insights" };
  const title = a.seoTitle || a.title; const description = a.seoDescription || a.excerpt;
  return { title, description, alternates: { canonical: a.canonicalUrl || `${SITE_URL}/insights/${a.slug}` },
    openGraph: { type: "article", title, description, publishedTime: a.publishedAt?.toISOString(), modifiedTime: a.updatedAt.toISOString() } };
}

export default async function InsightPage({ params }: Props) {
  const { slug } = await params;
  const a = await getPublishedInsight(getPrisma(), slug);
  if (!a) notFound();
  // Structured data for search engines. "<" is escaped so article text can never close the script tag.
  const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: a.title, description: a.excerpt,
    datePublished: a.publishedAt?.toISOString(), dateModified: a.updatedAt.toISOString(), ...(a.author ? { author: { "@type": "Person", name: a.author.name } } : {}),
    publisher: { "@type": "Organization", name: company.name }, mainEntityOfPage: `${SITE_URL}/insights/${a.slug}` }).replace(/</g, "\\u003c");
  return (
    <>
      <PageHero eyebrow={a.category?.name ?? "Insight"} title={a.title} description={a.excerpt} />
      <article className="bg-white py-16 sm:py-24">
        <Container className="max-w-3xl">
          <Link href="/insights" className="text-sm text-electric-600 underline">← All insights</Link>
          <p className="mt-6 text-sm text-slate-500">{a.author ? `${a.author.name} · ` : ""}{fmt(a.publishedAt)} · {readingMinutes(a.body)} min read</p>
          <div className="mt-8"><ArticleBody text={a.body} /></div>
          {a.tags.length > 0 && <p className="mt-10 text-sm text-slate-500">Topics: {a.tags.map((t: { tag: { name: string } }) => t.tag.name).join(", ")}</p>}
        </Container>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      </article>
    </>
  );
}
