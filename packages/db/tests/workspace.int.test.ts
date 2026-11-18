// Runs against the throw-away database (pnpm test:db). Unverified until run on a machine with PostgreSQL.
import { describe, expect, it } from "vitest";
import { ROLE_KEYS } from "@quantara/rbac";
import { ensureCustomerWorkspace } from "../src/workspace";
import { db, makeUser } from "./helpers";

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
});
