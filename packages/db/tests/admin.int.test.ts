// Runs against the throw-away database (pnpm test:db).
import { afterAll, describe, expect, it } from "vitest";
import { getMembershipContext } from "@quantara/auth";
import { can } from "@quantara/rbac";
import { createEnquiry } from "../src/enquiries";
import { getEnquiry, getPublicSettings, getSettings, getStaffMembership, grantStaffRole, listEnquiries, saveSettings, setEnquiryStatus } from "../src/admin";
import { db, id, makeMember, makeOrg, makeUser } from "./helpers";

async function staffOrg() {
  const existing = await db.organization.findFirst({ where: { type: "STAFF" } });
  return existing ?? makeOrg("STAFF");
}
const enquiry = (email: string) => createEnquiry(db, {
  fullName: "Asha Rao", businessEmail: email, organization: "Acme", jobDesignation: "CTO", country: "India",
  projectRequirements: "We need help with a data platform migration.", privacyConsent: true,
  consentTextVersion: "v1", spamScore: 0, ipHash: "h", userAgent: "t", idempotencyKey: id("idem"),
} as never, new Date());

describe("staff membership and permissions", () => {
  it("a customer is not staff; a staff member is, and permissions come from their role", async () => {
    const customer = await makeUser(); const clientOrg = await makeOrg("CLIENT"); await makeMember(clientOrg.id, customer.id, "admin");
    expect(await getStaffMembership(db, customer.id)).toBeNull();

    const org = await staffOrg(); const bd = await makeUser(); await makeMember(org.id, bd.id, "bd_manager");
    const m = await getStaffMembership(db, bd.id);
    expect(m?.organizationId).toBe(org.id);
    const ctx = await getMembershipContext(db, bd.id, org.id);
    expect(can(ctx, "enquiry:read")).toBe(true);
    expect(can(ctx, "site:settings:write")).toBe(false);
    expect(can(ctx, "audit:read")).toBe(false);
  });
  it("a customer org admin has no platform permissions even with the admin role", async () => {
    const u = await makeUser(); const org = await makeOrg("CLIENT"); await makeMember(org.id, u.id, "admin");
    const ctx = await getMembershipContext(db, u.id, org.id);
    expect(can(ctx, "enquiry:read")).toBe(false); expect(can(ctx, "site:settings:write")).toBe(false);
  });
  it("grantStaffRole adds the user, is idempotent, and rejects unknown roles and unknown emails", async () => {
    await staffOrg();
    const u = await makeUser();
    const r = await grantStaffRole(db, u.email, "content_manager");
    expect(r.role).toBe("content_manager");
    await grantStaffRole(db, u.email.toUpperCase(), "super_admin");
    expect((await getStaffMembership(db, u.id))?.role).toBe("super_admin");
    expect(await db.member.count({ where: { userId: u.id } })).toBe(1);
    await expect(grantStaffRole(db, u.email, "wizard")).rejects.toThrow(/Unknown role/);
    await expect(grantStaffRole(db, "nobody@example.test", "admin")).rejects.toThrow(/No user/);
  });
});

describe("enquiry inbox", () => {
  it("lists newest first, filters by status, paginates, and records status changes in the audit log", async () => {
    const org = await staffOrg(); const actor = await makeUser();
    const a = await enquiry(`${id("a")}@example.test`);
    await new Promise((r) => setTimeout(r, 15)); // distinct createdAt
    const b = await enquiry(`${id("b")}@example.test`);
    const idA = (await db.contactEnquiry.findUniqueOrThrow({ where: { referenceId: a.referenceId } })).id;
    const idB = (await db.contactEnquiry.findUniqueOrThrow({ where: { referenceId: b.referenceId } })).id;
    const all = await listEnquiries(db, { pageSize: 100 });
    const ids = all.items.map((i) => i.id);
    expect(ids.indexOf(idB)).toBeLessThan(ids.indexOf(idA));
    expect(await setEnquiryStatus(db, idA, "ACKNOWLEDGED", actor.id, org.id)).toBe(true);
    const ack = await listEnquiries(db, { status: "ACKNOWLEDGED", pageSize: 100 });
    expect(ack.items.some((i) => i.id === idA)).toBe(true); expect(ack.items.some((i) => i.id === idB)).toBe(false);
    expect((await getEnquiry(db, idA))?.acknowledgedAt).toBeInstanceOf(Date);
    const log = await db.auditLog.findFirst({ where: { action: "enquiry.status.changed", resourceId: idA } });
    expect(log?.actorId).toBe(actor.id); expect(log?.metadata).toMatchObject({ from: "RECEIVED", to: "ACKNOWLEDGED" });
    expect((await listEnquiries(db, { pageSize: 1 })).items).toHaveLength(1);
  });
  it("returns false for a missing enquiry and rejects an invalid status", async () => {
    const u = await makeUser();
    expect(await setEnquiryStatus(db, "00000000-0000-7000-8000-000000000000", "ARCHIVED", u.id, null)).toBe(false);
    await expect(setEnquiryStatus(db, "x", "BOGUS" as never, u.id, null)).rejects.toThrow(/Invalid/);
  });
});

describe("site settings", () => {
  // Restore whatever the seed put there so other test files see the same database as before.
  const KEYS = ["contact.email", "notifications.adminRecipients"];
  let original: { key: string; group: string; value: unknown; isPublic: boolean }[] = [];
  it("(setup) remembers the seeded rows", async () => {
    original = (await db.siteSetting.findMany({ where: { key: { in: KEYS } } })) as never;
  });
  afterAll(async () => {
    await db.siteSetting.deleteMany({ where: { key: { in: KEYS } } });
    for (const r of original) await db.siteSetting.create({ data: { key: r.key, group: r.group, value: r.value as never, isPublic: r.isPublic } });
  });
  it("saves, updates, removes, audits key names only, and exposes only public settings", async () => {
    const u = await makeUser();
    await db.siteSetting.deleteMany({ where: { key: { in: ["contact.email", "notifications.adminRecipients"] } } });
    const changed = await saveSettings(db, { "contact.email": "hello@example.test", "notifications.adminRecipients": "ops@example.test", "evil.key": "x" }, u.id, null);
    expect(changed.sort()).toEqual(["contact.email", "notifications.adminRecipients"]);
    expect(await db.siteSetting.findUnique({ where: { key: "evil.key" } })).toBeNull();
    expect((await getSettings(db))["contact.email"]).toBe("hello@example.test");
    const pub = await getPublicSettings(db);
    expect(pub["contact.email"]).toBe("hello@example.test"); expect(pub["notifications.adminRecipients"]).toBeUndefined();
    expect(await saveSettings(db, { "contact.email": "hello@example.test" }, u.id, null)).toEqual([]);
    expect(await saveSettings(db, { "contact.email": "" }, u.id, null)).toEqual(["contact.email"]);
    expect((await getSettings(db))["contact.email"]).toBeUndefined();
    const log = await db.auditLog.findFirst({ where: { action: "site.settings.updated", actorId: u.id }, orderBy: { createdAt: "asc" } });
    expect(JSON.stringify(log?.metadata)).not.toContain("example.test");
  });
});
