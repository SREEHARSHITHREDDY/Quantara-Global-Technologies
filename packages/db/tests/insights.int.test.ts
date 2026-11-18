// Runs against the throw-away database (pnpm test:db).
import { describe, expect, it } from "vitest";
import { getInsightAdmin, getPublishedInsight, listInsightCategories, listPublishedInsights, saveInsight, type InsightInput } from "../src/insights";
import { db, id, makeUser } from "./helpers";

const base = (over: Partial<InsightInput> = {}): InsightInput => ({ title: `Article ${id("t")}`, excerpt: "A short summary.", body: "## Heading\n\nSome body text.", status: "DRAFT", tags: [], ...over });
async function actor() { const u = await makeUser(); return { userId: u.id, name: "Asha Rao" }; }
async function published(over: Partial<InsightInput> = {}, when = new Date("2026-01-01T00:00:00Z")) {
  const r = await saveInsight(db, undefined, base({ status: "PUBLISHED", ...over }), await actor(), null, true, when);
  if (!r.ok) throw new Error(r.error); return r;
}

describe("public visibility", () => {
  it("shows only published articles whose date has arrived; drafts and archived stay hidden", async () => {
    const now = new Date("2026-11-18T10:00:00Z");
    const live = await published(); const future = await published({}, new Date("2027-06-01T00:00:00Z"));
    const draft = await saveInsight(db, undefined, base(), await actor(), null, true);
    const arch = await saveInsight(db, undefined, base({ status: "ARCHIVED" }), await actor(), null, true);
    const slugs = (await listPublishedInsights(db, { now, pageSize: 50 })).items.map((i) => i.slug);
    expect(slugs).toContain(live.slug); expect(slugs).not.toContain(future.slug);
    if (draft.ok) expect(slugs).not.toContain(draft.slug); if (arch.ok) expect(slugs).not.toContain(arch.slug);
    expect(await getPublishedInsight(db, future.slug, now)).toBeNull();
    expect((await getPublishedInsight(db, live.slug, now))?.body).toContain("Heading");
  });
  it("filters by category, orders newest first and paginates", async () => {
    const cat = `Cat ${id("c")}`; const a = await actor();
    const r1 = await saveInsight(db, undefined, base({ status: "PUBLISHED", newCategoryName: cat }), a, null, true, new Date("2026-02-01T00:00:00Z"));
    const r2 = await saveInsight(db, undefined, base({ status: "PUBLISHED", newCategoryName: cat }), a, null, true, new Date("2026-03-01T00:00:00Z"));
    if (!r1.ok || !r2.ok) throw new Error("save failed");
    const slug = (await listInsightCategories(db)).find((c) => c.name === cat)!.slug;
    const all = await listPublishedInsights(db, { categorySlug: slug, now: new Date("2026-11-18T00:00:00Z") });
    expect(all.items.map((i) => i.slug)).toEqual([r2.slug, r1.slug]); expect(all.total).toBe(2);
    const p1 = await listPublishedInsights(db, { categorySlug: slug, pageSize: 1, page: 1, now: new Date("2026-11-18T00:00:00Z") });
    expect(p1.items).toHaveLength(1); expect(p1.pages).toBe(2);
  });
});

describe("saveInsight", () => {
  it("sets publishedAt on first publish and keeps it; creates the author, category and tags once", async () => {
    const a = await actor(); const t1 = new Date("2026-05-01T00:00:00Z"), t2 = new Date("2026-06-01T00:00:00Z");
    const d = await saveInsight(db, undefined, base({ newCategoryName: "Quantum", tags: ["AI", "Quantum Computing"] }), a, null, true, t1);
    if (!d.ok) throw new Error(d.error);
    let row = await db.insight.findUniqueOrThrow({ where: { id: d.id } }); expect(row.publishedAt).toBeNull();
    await saveInsight(db, d.id, base({ title: row.title, slug: d.slug, status: "PUBLISHED", tags: ["AI"] }), a, null, true, t1);
    await saveInsight(db, d.id, base({ title: row.title, slug: d.slug, status: "PUBLISHED", excerpt: "Changed", tags: ["AI"] }), a, null, true, t2);
    row = await db.insight.findUniqueOrThrow({ where: { id: d.id } });
    expect(row.publishedAt?.toISOString()).toBe(t1.toISOString()); expect(row.excerpt).toBe("Changed");
    expect(await db.author.count({ where: { userId: a.userId } })).toBe(1);
    expect((await getInsightAdmin(db, d.id))?.tags.map((t: { tag: { name: string } }) => t.tag.name)).toEqual(["AI"]);
    expect(await db.insightCategory.count({ where: { slug: "quantum" } })).toBe(1);
  });
  it("blocks publishing, and editing a published article, without permission", async () => {
    const a = await actor();
    expect(await saveInsight(db, undefined, base({ status: "PUBLISHED" }), a, null, false)).toMatchObject({ ok: false, error: expect.stringMatching(/permission to publish/) });
    const pub = await published();
    expect(await saveInsight(db, pub.id, base({ slug: pub.slug, status: "DRAFT" }), a, null, false)).toMatchObject({ ok: false });
    expect(await saveInsight(db, undefined, base(), a, null, false)).toMatchObject({ ok: true });
  });
  it("rejects a duplicate slug, audits changes, and the database refuses a bad slug", async () => {
    const a = await actor(); const slug = id("same"); const first = await saveInsight(db, undefined, base({ slug }), a, null, true);
    if (!first.ok) throw new Error(first.error);
    expect(await saveInsight(db, undefined, base({ slug: first.slug }), a, null, true)).toMatchObject({ ok: false, error: expect.stringMatching(/slug/) });
    expect(await db.auditLog.count({ where: { action: "insight.created", resourceId: first.id } })).toBe(1);
    await expect(db.insight.create({ data: { slug: "Bad Slug!", title: "t", excerpt: "e", body: "b" } })).rejects.toThrow();
  });
});
