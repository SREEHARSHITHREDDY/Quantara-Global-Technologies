"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { INSIGHT_STATUSES, getPrisma, parseTags, saveInsight, type InsightStatusValue } from "@quantara/db";
import { can } from "@quantara/rbac";
import { requireStaff } from "@/lib/admin";

export interface InsightFormState { status: "idle" | "saved" | "error"; message?: string; fieldErrors?: Record<string, string> }

const optionalText = (max: number) => z.string().trim().max(max, `Too long (max ${max})`).optional().transform((v) => v || undefined);
const schema = z.object({
  title: z.string().trim().min(5, "Title is required (at least 5 characters)").max(160),
  slug: optionalText(80),
  excerpt: z.string().trim().min(20, "Write a summary of at least 20 characters").max(300, "Summary is too long (max 300)"),
  body: z.string().trim().min(50, "The article needs at least 50 characters").max(60000, "The article is too long"),
  status: z.enum(INSIGHT_STATUSES as [InsightStatusValue, ...InsightStatusValue[]], { error: "Choose a status" }),
  categoryId: optionalText(64), newCategoryName: optionalText(80), tags: z.string().max(600).default(""),
  seoTitle: optionalText(70), seoDescription: optionalText(170),
  canonicalUrl: z.string().trim().max(300).optional().transform((v) => v || undefined).refine((v) => v === undefined || /^https:\/\/[^\s]+$/.test(v), "Enter a full https:// address"),
});

export async function saveInsightAction(_prev: InsightFormState, formData: FormData): Promise<InsightFormState> {
  const s = await requireStaff("insight:write"); // re-checked on every submit
  const id = String(formData.get("id") ?? "") || undefined;
  const raw: Record<string, unknown> = {}; formData.forEach((v, k) => { if (typeof v === "string") raw[k] = v; });
  const p = schema.safeParse(raw);
  if (!p.success) {
    const fieldErrors: Record<string, string> = {}; for (const i of p.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors };
  }
  const d = p.data;
  const r = await saveInsight(getPrisma(), id, { title: d.title, slug: d.slug, excerpt: d.excerpt, body: d.body, status: d.status, categoryId: d.categoryId,
    newCategoryName: d.newCategoryName, tags: parseTags(d.tags), seoTitle: d.seoTitle, seoDescription: d.seoDescription, canonicalUrl: d.canonicalUrl },
    { userId: s.userId, name: s.name }, s.organizationId, can(s.ctx, "insight:publish"));
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/admin/insights"); revalidatePath("/insights"); revalidatePath(`/insights/${r.slug}`);
  if (!id) redirect(`/admin/insights/${r.id}`);
  return { status: "saved", message: "Saved." };
}
