import type { PrismaClient } from "./generated/client";
import { slugify } from "./careers";

export type InsightStatusValue = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
export const INSIGHT_STATUSES: readonly InsightStatusValue[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const isUniqueViolation = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

export interface PublicInsightCard { id: string; slug: string; title: string; excerpt: string; publishedAt: Date | null; category: { slug: string; name: string } | null; author: { name: string } | null }
export interface PublicInsight extends PublicInsightCard { body: string; seoTitle: string | null; seoDescription: string | null; canonicalUrl: string | null; updatedAt: Date; tags: { tag: { slug: string; name: string } }[] }

/** Visible on the website: PUBLISHED and its publication date has arrived. */
export const publishedWhere = (now: Date) => ({ status: "PUBLISHED" as const, publishedAt: { lte: now } });

export async function listPublishedInsights(db: PrismaClient, opts: { categorySlug?: string; page?: number; pageSize?: number; now?: Date } = {}): Promise<{ items: PublicInsightCard[]; total: number; page: number; pages: number }> {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 9, 1), 50); const page = Math.max(opts.page ?? 1, 1);
  const where = { ...publishedWhere(opts.now ?? new Date()), ...(opts.categorySlug ? { category: { slug: opts.categorySlug } } : {}) };
  const [items, total] = await Promise.all([
    db.insight.findMany({ where, orderBy: { publishedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
      select: { id: true, slug: true, title: true, excerpt: true, publishedAt: true, category: { select: { slug: true, name: true } }, author: { select: { name: true } } } }),
    db.insight.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
export async function getPublishedInsight(db: PrismaClient, slug: string, now = new Date()): Promise<PublicInsight | null> {
  return db.insight.findFirst({ where: { slug, ...publishedWhere(now) },
    select: { id: true, slug: true, title: true, excerpt: true, body: true, publishedAt: true, updatedAt: true, seoTitle: true, seoDescription: true, canonicalUrl: true,
      category: { select: { slug: true, name: true } }, author: { select: { name: true } }, tags: { select: { tag: { select: { slug: true, name: true } } } } } });
}
export async function listInsightCategories(db: PrismaClient): Promise<{ id: string; slug: string; name: string }[]> {
  return db.insightCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, slug: true, name: true } });
}

// ───────────── Admin ─────────────

export async function listInsightsAdmin(db: PrismaClient) {
  return db.insight.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, slug: true, title: true, status: true, publishedAt: true, updatedAt: true, category: { select: { name: true } } } });
}
export async function getInsightAdmin(db: PrismaClient, id: string) {
  return db.insight.findUnique({ where: { id }, include: { tags: { select: { tag: { select: { name: true } } } }, category: { select: { id: true, name: true } } } });
}

export interface InsightInput {
  title: string; slug?: string | undefined; excerpt: string; body: string; status: InsightStatusValue;
  categoryId?: string | undefined; newCategoryName?: string | undefined; tags: string[];
  seoTitle?: string | undefined; seoDescription?: string | undefined; canonicalUrl?: string | undefined;
}
export const parseTags = (text: string): string[] => [...new Set(text.split(",").map((t) => t.trim().replace(/\s+/g, " ")).filter(Boolean).map((t) => t.slice(0, 40)))].slice(0, 10);

export type SaveInsightResult = { ok: true; id: string; slug: string } | { ok: false; error: string };
type Tx = Pick<PrismaClient, "insight" | "insightTag" | "tag" | "insightCategory" | "author" | "auditLog">;

export async function saveInsight(db: PrismaClient, id: string | undefined, input: InsightInput, actor: { userId: string; name: string }, organizationId: string | null, canPublish: boolean, now = new Date()): Promise<SaveInsightResult> {
  const slug = slugify(input.slug?.trim() || input.title);
  if (!slug) return { ok: false, error: "A title or slug is required" };
  const existing = id ? await db.insight.findUnique({ where: { id }, select: { status: true, publishedAt: true, authorId: true } }) : null;
  if (id && !existing) return { ok: false, error: "Article not found" };
  if (input.status === "PUBLISHED" && !canPublish && existing?.status !== "PUBLISHED") return { ok: false, error: "You do not have permission to publish articles" };
  if (existing?.status === "PUBLISHED" && !canPublish) return { ok: false, error: "You do not have permission to change a published article" };
  const publishedAt = input.status === "PUBLISHED" ? (existing?.publishedAt ?? now) : (existing?.publishedAt ?? null);
  try {
    const row = await db.$transaction(async (tx: Tx) => {
      let categoryId: string | null = input.categoryId || null;
      const newName = input.newCategoryName?.trim();
      if (newName) {
        const cs = slugify(newName);
        if (cs) categoryId = (await tx.insightCategory.upsert({ where: { slug: cs }, update: {}, create: { slug: cs, name: newName.slice(0, 80) }, select: { id: true } })).id;
      }
      let authorId = existing?.authorId ?? null;
      if (!authorId) {
        const a = await tx.author.findFirst({ where: { userId: actor.userId }, select: { id: true } });
        authorId = a?.id ?? (await tx.author.create({ data: { name: actor.name, userId: actor.userId }, select: { id: true } })).id;
      }
      const data = { slug, title: input.title, excerpt: input.excerpt, body: input.body, status: input.status, publishedAt, categoryId, authorId,
        seoTitle: input.seoTitle || null, seoDescription: input.seoDescription || null, canonicalUrl: input.canonicalUrl || null };
      const saved = id ? await tx.insight.update({ where: { id }, data, select: { id: true, slug: true } }) : await tx.insight.create({ data, select: { id: true, slug: true } });
      await tx.insightTag.deleteMany({ where: { insightId: saved.id } });
      for (const name of input.tags) {
        const ts = slugify(name); if (!ts) continue;
        const tag = await tx.tag.upsert({ where: { slug: ts }, update: {}, create: { slug: ts, name }, select: { id: true } });
        await tx.insightTag.upsert({ where: { insightId_tagId: { insightId: saved.id, tagId: tag.id } }, update: {}, create: { insightId: saved.id, tagId: tag.id } });
      }
      await tx.auditLog.create({ data: { organizationId, actorId: actor.userId, action: id ? "insight.updated" : "insight.created", resourceType: "insight", resourceId: saved.id, metadata: { status: input.status } } });
      return saved;
    });
    return { ok: true, id: row.id, slug: row.slug };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "Another article already uses this slug" };
    throw e;
  }
}
