// Runs against the throw-away database (pnpm test:db). Unverified until run on a machine with PostgreSQL.
import { describe, expect, it } from "vitest";
import { ROLE_KEYS } from "@quantara/rbac";
import { ensureCustomerWorkspace } from "../src/workspace";
import { enableCouncilForDisabledCustomers } from "../src/council";
import { db, makeOrg, makeUser } from "./helpers";

describe("ensureCustomerWorkspace", () => {
  it("creates a CLIENT organization with the user as admin and all system roles provisioned", async () => {
    const u = await makeUser(); const r = await ensureCustomerWorkspace(db, { id: u.id, name: "Asha Rao" });
    expect(r.created).toBe(true);
    const org = await db.organization.findUniqueOrThrow({ where: { id: r.organizationId }, include: { members: true, roles: true } });
    expect(org.type).toBe("CLIENT"); expect(org.status).toBe("ACTIVE"); expect(org.name).toBe("Asha Rao's workspace");
    expect(org.slug).toMatch(/^asha-rao-[0-9a-f]{6}$/);
    expect(org.members).toHaveLength(1); expect(org.members[0]?.role).toBe("admin"); expect(org.members[0]?.userId).toBe(u.id);
    expect(org.roles.map((x) => x.key).sort()).toEqual([...ROLE_KEYS].sort());
  });
  it("is idempotent, including under concurrent calls", async () => {
    const u = await makeUser();
    const out = await Promise.all([1, 2, 3, 4].map(() => ensureCustomerWorkspace(db, { id: u.id, name: "Concurrent" })));
    expect(new Set(out.map((o) => o.organizationId)).size).toBe(1);
    expect(out.filter((o) => o.created)).toHaveLength(1);
    expect(await db.member.count({ where: { userId: u.id } })).toBe(1);
  });
  it("repairs a workspace whose roles were never provisioned", async () => {
    const u = await makeUser(); const r = await ensureCustomerWorkspace(db, { id: u.id, name: "Repair" });
    await db.role.deleteMany({ where: { organizationId: r.organizationId } });
    const again = await ensureCustomerWorkspace(db, { id: u.id, name: "Repair" });
    expect(again).toEqual({ organizationId: r.organizationId, created: false });
    expect(await db.role.count({ where: { organizationId: r.organizationId } })).toBe(ROLE_KEYS.length);
  });
  it("handles unusual names", async () => {
    const u = await makeUser(); const r = await ensureCustomerWorkspace(db, { id: u.id, name: "  ***  " });
    expect((await db.organization.findUniqueOrThrow({ where: { id: r.organizationId } })).slug).toMatch(/^workspace-[0-9a-f]{6}$/);
  });
  it("a new workspace is closed unless a default plan is given, and a default is audited", async () => {
    const a = await makeUser(); const closed = await ensureCustomerWorkspace(db, { id: a.id, name: "Closed" });
    expect((await db.organization.findUniqueOrThrow({ where: { id: closed.organizationId } })).councilPlan).toBe("DISABLED");
    const b = await makeUser(); const open = await ensureCustomerWorkspace(db, { id: b.id, name: "Open" }, { councilPlan: "STANDARD" });
    const org = await db.organization.findUniqueOrThrow({ where: { id: open.organizationId } });
    expect(org.councilPlan).toBe("STANDARD"); expect(org.councilTrialEndsAt).toBeNull();
    expect(await db.auditLog.count({ where: { resourceId: open.organizationId, action: "council.plan.set", actorType: "system" } })).toBe(1);
  });
  it("a trial default gets an end date", async () => {
    const u = await makeUser(); const w = await ensureCustomerWorkspace(db, { id: u.id, name: "Trial" }, { councilPlan: "TRIAL", councilTrialDays: 10 });
    const org = await db.organization.findUniqueOrThrow({ where: { id: w.organizationId } });
    expect(org.councilPlan).toBe("TRIAL");
    const days = (org.councilTrialEndsAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(9.9); expect(days).toBeLessThan(10.1);
  });
  it("enabling for disabled customers changes only disabled customer workspaces", async () => {
    const disabled = await makeOrg("CLIENT"); const staff = await makeOrg("STAFF"); const trial = await makeOrg("CLIENT");
    await db.organization.update({ where: { id: trial.id }, data: { councilPlan: "ENTERPRISE" } });
    const n = await enableCouncilForDisabledCustomers(db, { plan: "STANDARD" });
    expect(n).toBeGreaterThanOrEqual(1);
    const plan = async (id: string) => (await db.organization.findUniqueOrThrow({ where: { id } })).councilPlan;
    expect(await plan(disabled.id)).toBe("STANDARD"); expect(await plan(staff.id)).toBe("DISABLED"); expect(await plan(trial.id)).toBe("ENTERPRISE");
  });
});
