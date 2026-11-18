import type { Metadata } from "next";
import { INSIGHT_STATUSES, getPrisma, listInsightCategories } from "@quantara/db";
import { can } from "@quantara/rbac";
import { Card } from "@/components/ui/layout";
import { requireStaff } from "@/lib/admin";
import { InsightForm } from "../insight-form";

export const metadata: Metadata = { title: "New article" };

export default async function NewInsightPage() {
  const s = await requireStaff("insight:write");
  const categories = await listInsightCategories(getPrisma());
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold text-navy-900">New article</h1>
      <Card><InsightForm canPublish={can(s.ctx, "insight:publish")} categories={categories} statuses={[...INSIGHT_STATUSES]}
        defaults={{ title: "", slug: "", excerpt: "", body: "", status: "DRAFT", categoryId: "", tags: "", seoTitle: "", seoDescription: "", canonicalUrl: "" }} /></Card>
    </div>
  );
}
