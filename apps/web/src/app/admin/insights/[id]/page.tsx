import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { INSIGHT_STATUSES, getInsightAdmin, getPrisma, listInsightCategories } from "@quantara/db";
import { can } from "@quantara/rbac";
import { Card } from "@/components/ui/layout";
import { requireStaff } from "@/lib/admin";
import { InsightForm } from "../insight-form";

export const metadata: Metadata = { title: "Edit article" };

export default async function EditInsightPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff("insight:write");
  const { id } = await params;
  const db = getPrisma();
  const [a, categories] = await Promise.all([getInsightAdmin(db, id), listInsightCategories(db)]);
  if (!a) notFound();
  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/admin/insights" className="text-sm text-electric-600 underline">← All articles</Link>
      <h1 className="text-2xl font-semibold text-navy-900">{a.title}</h1>
      <Card><InsightForm canPublish={can(s.ctx, "insight:publish")} categories={categories} statuses={[...INSIGHT_STATUSES]} publicHref={`/insights/${a.slug}`}
        defaults={{ id: a.id, title: a.title, slug: a.slug, excerpt: a.excerpt, body: a.body, status: a.status === "IN_REVIEW" ? "DRAFT" : a.status, categoryId: a.categoryId ?? "",
          tags: a.tags.map((t: { tag: { name: string } }) => t.tag.name).join(", "), seoTitle: a.seoTitle ?? "", seoDescription: a.seoDescription ?? "", canonicalUrl: a.canonicalUrl ?? "" }} /></Card>
    </div>
  );
}
