// STATUS: unverified — written but never executed.
import { describe, it, expect } from "vitest";
import { ROLE_KEYS, ROLES } from "@quantara/rbac";
import { services, industries, marketStatistics } from "@quantara/content";
import { AGENT_CODES } from "@quantara/council";
import { db } from "./helpers";
import { STAFF_ORG } from "../src/seed/seed";

describe("seed", () => {
  it("loads all profile services, capabilities and industries", async () => {
    expect(await db.service.count()).toBe(services.length);
    expect(await db.serviceCapability.count()).toBe(48);
    expect(await db.industry.count()).toBe(industries.length);
    expect(await db.service.count({ where: { status: "PUBLISHED" } })).toBe(9);
  });
  it("provisions the 7 roles with exactly the code-defined permissions", async () => {
    const roles = await db.role.findMany({ where: { organizationId: STAFF_ORG.id }, include: { permissions: { include: { permission: true } } } });
    expect(roles.map((r) => r.key).sort()).toEqual([...ROLE_KEYS].sort());
    for (const r of roles) expect(r.permissions.map((p) => p.permission.key).sort()).toEqual([...ROLES[r.key as keyof typeof ROLES].permissions].sort());
  });
  it("leaves contact/leadership settings empty (never hardcoded)", async () => {
    const email = await db.siteSetting.findUnique({ where: { key: "contact.email" } });
    expect(email?.value).toBe("");
  });
  it("seeds statistics but publishes none by default", async () => {
    expect(await db.marketStatistic.count()).toBe(marketStatistics.length);
    expect(await db.marketStatistic.count({ where: { isPublished: true } })).toBe(0);
    expect(await db.marketStatistic.count({ where: { sourceId: null } })).toBe(marketStatistics.filter((m) => !m.sourceKey).length);
  });
  it("all integrations and AI providers start disabled", async () => {
    expect(await db.integrationStatus.count({ where: { OR: [{ isEnabled: true }, { isConfigured: true }] } })).toBe(0);
    expect(await db.providerConfig.count({ where: { isEnabled: true } })).toBe(0);
  });
  it("seeds the ten council agents, CEO as supervisor, and leaves council off for clients", async () => {
    // other tests create throwaway agents in the same database; look only at the real codes
    const agents = await db.agent.findMany({ where: { key: { in: [...AGENT_CODES] } }, orderBy: { sortOrder: "asc" } });
    expect(agents.map((a) => a.key)).toEqual(["CEO", "CFO", "CTO", "COO", "CMO", "CRO", "CHRO", "CLO", "CISO", "CSO"]);
    expect(agents.filter((a) => a.isSupervisor).map((a) => a.key)).toEqual(["CEO"]);
    expect((await db.organization.findUnique({ where: { id: STAFF_ORG.id } }))?.councilPlan).toBe("ENTERPRISE");
    expect(await db.organization.count({ where: { type: "CLIENT", councilPlan: { not: "DISABLED" } } })).toBe(0);
  });
  it("is idempotent", async () => {
    const { seedAll } = await import("../src/seed/seed");
    await seedAll(db);
    expect(await db.service.count()).toBe(services.length);
    expect(await db.serviceCapability.count()).toBe(48);
    expect(await db.agent.count({ where: { key: { in: [...AGENT_CODES] } } })).toBe(10);
  });
});
