// STATUS: unverified (needs generated Prisma client + migrated database).
import { approachSteps, company, coreValues, industries, marketStatistics, requiredSiteSettings, services, sources, whyQuantara } from "@quantara/content";
import type { PrismaClient } from "../generated/client";
import { provisionOrganizationRoles } from "../provision";

export interface SeedOptions {
  /**
   * DEV ONLY. Marks sourced statistics as published and verified by "dev-seed (unreviewed)".
   * Never enable in production: a human must verify each statistic against its source.
   */
  publishSourcedStatistics?: boolean;
  log?: (msg: string) => void;
}

export const STAFF_ORG = { id: "org_quantara_staff", slug: "quantara-staff", name: "Quantara Technologies (Staff)" } as const;

export async function seedAll(db: PrismaClient, opts: SeedOptions = {}) {
  const log = opts.log ?? (() => {});

  // 1. Staff organization + roles/permissions
  await db.organization.upsert({
    where: { id: STAFF_ORG.id }, update: { type: "STAFF" },
    create: { ...STAFF_ORG, type: "STAFF", status: "ACTIVE", createdAt: new Date() },
  });
  await provisionOrganizationRoles(db, STAFF_ORG.id);
  log("organization + roles");

  // 2. Services, capabilities, industries (published: content comes from the corporate profile)
  const serviceIds = new Map<string, string>(); const industryIds = new Map<string, string>();
  for (const [i, s] of services.entries()) {
    const row = await db.service.upsert({
      where: { slug: s.slug },
      update: { title: s.title, summary: s.summary, introduction: s.introduction, overview: s.overview, businessChallenges: s.businessChallenges, enterpriseApplications: s.enterpriseApplications, sortOrder: i },
      create: { slug: s.slug, title: s.title, summary: s.summary, introduction: s.introduction, overview: s.overview, businessChallenges: s.businessChallenges, enterpriseApplications: s.enterpriseApplications, sortOrder: i, status: "PUBLISHED" },
    });
    serviceIds.set(s.slug, row.id);
    await db.serviceCapability.deleteMany({ where: { serviceId: row.id } });
    await db.serviceCapability.createMany({ data: s.capabilities.map((title, sortOrder) => ({ serviceId: row.id, title, sortOrder })) });
  }
  for (const [i, ind] of industries.entries()) {
    const row = await db.industry.upsert({
      where: { slug: ind.slug },
      update: { title: ind.title, summary: ind.summary, introduction: ind.introduction, challenges: ind.challenges, sortOrder: i },
      create: { slug: ind.slug, title: ind.title, summary: ind.summary, introduction: ind.introduction, challenges: ind.challenges, sortOrder: i, status: "PUBLISHED" },
    });
    industryIds.set(ind.slug, row.id);
  }
  // relations (union of both directions)
  const pairs = new Set<string>();
  for (const s of services) for (const i of s.relatedIndustrySlugs) pairs.add(`${s.slug}|${i}`);
  for (const i of industries) for (const s of i.relatedServiceSlugs) pairs.add(`${s}|${i.slug}`);
  await db.serviceIndustry.deleteMany({});
  await db.serviceIndustry.createMany({ data: [...pairs].map((p) => { const [s, i] = p.split("|"); return { serviceId: serviceIds.get(s!)!, industryId: industryIds.get(i!)! }; }) });
  await db.serviceRelation.deleteMany({});
  await db.serviceRelation.createMany({ data: services.flatMap((s) => s.relatedServiceSlugs.map((r) => ({ fromId: serviceIds.get(s.slug)!, toId: serviceIds.get(r)! }))) });
  log(`services=${services.length} industries=${industries.length}`);

  // 3. Company pages (CMS-editable blocks)
  const upsertPage = async (key: string, title: string, blocks: { key: string; type: string; data: unknown }[]) => {
    const page = await db.page.upsert({ where: { key }, update: { title }, create: { key, title, status: "PUBLISHED" } });
    for (const [sortOrder, b] of blocks.entries()) {
      await db.contentBlock.upsert({
        where: { pageId_key: { pageId: page.id, key: b.key } },
        update: { type: b.type, data: b.data as object, sortOrder },
        create: { pageId: page.id, key: b.key, type: b.type, data: b.data as object, sortOrder },
      });
    }
  };
  await upsertPage("home", "Home", [
    { key: "hero", type: "hero", data: { headline: company.tagline, supporting: company.supportingTagline, primaryCtas: ["Explore Our Capabilities", "Talk to Our Experts"], secondaryCta: "Discover the Executive AI Council" } },
    { key: "closing", type: "cta", data: { headline: company.ctaHeadline, body: company.ctaBody, tagline: company.closingTagline } },
  ]);
  await upsertPage("about", "About Us", [
    { key: "about", type: "richtext", data: { headline: company.aboutHeadline, paragraphs: company.about } },
    { key: "vision", type: "statement", data: { text: company.vision } },
    { key: "mission", type: "statement", data: { text: company.mission } },
    { key: "values", type: "list", data: { items: coreValues } },
    { key: "why", type: "list", data: { items: whyQuantara } },
  ]);
  await upsertPage("approach", "Our Approach", [{ key: "steps", type: "steps", data: { items: approachSteps } }]);

  // 4. Site settings (CMS-managed; intentionally EMPTY: the profile contains none of these)
  for (const key of requiredSiteSettings) {
    await db.siteSetting.upsert({ where: { key }, update: {}, create: { key, group: key.split(".")[0]!, value: "", isPublic: !["analytics", "notifications"].includes(key.split(".")[0]!) } });
  }

  // 5. Market statistics with sources
  const sourceIds = new Map<string, string>();
  for (const s of sources) {
    const row = await db.source.upsert({
      where: { url_publishedAt: { url: s.url, publishedAt: new Date(s.publishedAt) } },
      update: { title: s.title, publisher: s.publisher, kind: s.kind, accessedAt: new Date(s.accessedAt), notes: s.notes ?? null },
      create: { title: s.title, publisher: s.publisher, url: s.url, kind: s.kind, publishedAt: new Date(s.publishedAt), accessedAt: new Date(s.accessedAt), notes: s.notes ?? null },
    });
    sourceIds.set(s.key, row.id);
  }
  for (const m of marketStatistics) {
    const sourceId = m.sourceKey ? sourceIds.get(m.sourceKey)! : null;
    const publish = !!opts.publishSourcedStatistics && !!sourceId;
    const data = { statement: m.statement, theme: m.theme, sourceId, asOf: m.asOf ? new Date(m.asOf) : null };
    await db.marketStatistic.upsert({
      where: { key: m.key }, update: data,
      create: { key: m.key, ...data, isPublished: publish, verifiedAt: publish ? new Date() : null, verifiedBy: publish ? "dev-seed (unreviewed)" : null },
    });
  }
  log(`statistics=${marketStatistics.length}`);

  // 6. Integrations + AI providers: all DISABLED / unconfigured until credentials exist
  const integrations: [string, string][] = [["email", "Transactional email (Resend)"], ["smtp", "SMTP"], ["google-analytics", "Google Analytics"], ["search-console", "Google Search Console"],
    ["spam-protection", "Spam protection (Turnstile)"], ["storage", "S3-compatible storage"], ["calendar", "Calendar scheduling"], ["crm", "CRM"], ["newsletter", "Newsletter service"], ["sentry", "Sentry"]];
  for (const [key, displayName] of integrations) await db.integrationStatus.upsert({ where: { key }, update: { displayName }, create: { key, displayName, isEnabled: false, isConfigured: false } });
  const providers = [
    { key: "anthropic", provider: "ANTHROPIC" as const, displayName: "Anthropic", defaultModel: "claude-sonnet-5-5", credentialEnvVar: "ANTHROPIC_API_KEY", fallbackOrder: 1 },
    { key: "openai", provider: "OPENAI" as const, displayName: "OpenAI", defaultModel: "", credentialEnvVar: "OPENAI_API_KEY", fallbackOrder: 2 },
  ];
  for (const p of providers) await db.providerConfig.upsert({ where: { key: p.key }, update: { displayName: p.displayName }, create: { ...p, isEnabled: false } });
  log("integrations + providers (all disabled)");
}
