import { describe, it, expect } from "vitest";
import { can, canReadCouncilRecord, ROLES, ROLE_KEYS, ALL_PERMISSIONS, PLATFORM_PERMISSIONS, assertCan, ForbiddenError, type MembershipContext } from "./index";

const staff = (role: string): MembershipContext => ({ role, orgType: "STAFF", orgStatus: "ACTIVE" });
const client = (role: string): MembershipContext => ({ role, orgType: "CLIENT", orgStatus: "ACTIVE" });

describe("role matrix", () => {
  it("only references defined permissions", () => {
    for (const r of ROLE_KEYS) for (const p of ROLES[r].permissions) expect(ALL_PERMISSIONS).toContain(p);
  });
  it("super_admin holds every permission", () => { for (const p of ALL_PERMISSIONS) expect(can(staff("super_admin"), p)).toBe(true); });
  it("the 7 roles from the brief exist", () => { expect(ROLE_KEYS.sort()).toEqual(["admin","ai_platform_admin","bd_manager","content_manager","council_user","hr_manager","super_admin"]); });
  it("separation of duties between functional roles", () => {
    expect(can(staff("content_manager"), "application:read")).toBe(false);
    expect(can(staff("content_manager"), "lead:read")).toBe(false);
    expect(can(staff("hr_manager"), "lead:read")).toBe(false);
    expect(can(staff("hr_manager"), "content:publish")).toBe(false);
    expect(can(staff("bd_manager"), "application:resume:download")).toBe(false);
    expect(can(staff("bd_manager"), "insight:publish")).toBe(false);
    expect(can(staff("ai_platform_admin"), "lead:read")).toBe(false);
    expect(can(staff("hr_manager"), "application:resume:download")).toBe(true);
  });
  it("only super_admin can manage organizations; only AI admins manage providers (plus super)", () => {
    for (const r of ROLE_KEYS) {
      expect(can(staff(r), "org:manage")).toBe(r === "super_admin");
      expect(can(staff(r), "ai:provider:manage")).toBe(r === "super_admin" || r === "ai_platform_admin");
    }
  });
});

describe("default deny and organization scoping", () => {
  it("denies null/unknown/empty roles", () => {
    expect(can(null, "council:use")).toBe(false);
    expect(can(staff(""), "council:use")).toBe(false);
    expect(can(staff("root"), "council:use")).toBe(false);
    expect(can(staff("admin,root"), "council:use")).toBe(false);
  });
  it("platform permissions never apply inside CLIENT organizations, even for super_admin", () => {
    for (const p of PLATFORM_PERMISSIONS) { expect(can(client("super_admin"), p)).toBe(false); expect(can(client("admin"), p)).toBe(false); }
  });
  it("organization-scoped permissions work in CLIENT orgs", () => {
    expect(can(client("council_user"), "council:use")).toBe(true);
    expect(can(client("admin"), "user:invite")).toBe(true);
    expect(can(client("council_user"), "user:invite")).toBe(false);
    expect(can(client("council_user"), "council:approval:decide")).toBe(false);
  });
  it("suspended org or banned user is denied everything", () => {
    expect(can({ ...staff("super_admin"), orgStatus: "SUSPENDED" }, "council:use")).toBe(false);
    expect(can({ ...staff("super_admin"), userBanned: true }, "council:use")).toBe(false);
  });
  it("assertCan throws a 403 ForbiddenError", () => {
    expect(() => assertCan(client("council_user"), "audit:read")).toThrow(ForbiddenError);
    try { assertCan(client("council_user"), "audit:read"); } catch (e) { expect((e as ForbiddenError).status).toBe(403); }
  });
});

describe("council record isolation", () => {
  const rec = { ownerId: "u1", organizationId: "o1" };
  it("owner can read own record", () => { expect(canReadCouncilRecord(client("council_user"), rec, { userId: "u1", organizationId: "o1" })).toBe(true); });
  it("another member cannot read it", () => { expect(canReadCouncilRecord(client("council_user"), rec, { userId: "u2", organizationId: "o1" })).toBe(false); });
  it("org admin with history permission can", () => { expect(canReadCouncilRecord(client("admin"), rec, { userId: "u2", organizationId: "o1" })).toBe(true); });
  it("nobody can cross organizations, even an admin", () => { expect(canReadCouncilRecord(client("admin"), rec, { userId: "u2", organizationId: "o2" })).toBe(false); });
});
