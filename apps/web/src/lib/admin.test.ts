import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ session: null as unknown, staff: null as unknown, ctx: null as unknown }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); },
  notFound: () => { throw new Error("NOT_FOUND"); },
}));
vi.mock("@/lib/auth", () => ({ getAuth: () => ({ api: { getSession: async () => h.session } }) }));
vi.mock("@quantara/db", () => ({ getPrisma: () => ({}), getStaffMembership: async () => h.staff }));
vi.mock("@quantara/auth", () => ({ getMembershipContext: async () => h.ctx }));

import { requireStaff } from "./admin";

const session = { user: { id: "u1", name: "Asha", email: "a@example.test" } };
const staff = { organizationId: "org1", role: "bd_manager" };
const ctx = (role: string, extra = {}) => ({ role, orgType: "STAFF", orgStatus: "ACTIVE", userBanned: false, ...extra });

beforeEach(() => { h.session = session; h.staff = staff; h.ctx = ctx("bd_manager"); });

describe("requireStaff", () => {
  it("sends signed-out visitors to the staff entrance", async () => {
    h.session = null;
    await expect(requireStaff()).rejects.toThrow("REDIRECT:/staff");
  });
  it("returns 404 for signed-in customers who are not staff", async () => {
    h.staff = null;
    await expect(requireStaff()).rejects.toThrow("NOT_FOUND");
  });
  it("returns 404 when the membership context cannot be resolved", async () => {
    h.ctx = null;
    await expect(requireStaff("enquiry:read")).rejects.toThrow("NOT_FOUND");
  });
  it("allows a staff member who holds the permission", async () => {
    const s = await requireStaff("enquiry:manage");
    expect(s).toMatchObject({ userId: "u1", organizationId: "org1" });
  });
  it("returns 404 for staff who lack the permission", async () => {
    await expect(requireStaff("site:settings:write")).rejects.toThrow("NOT_FOUND");
  });
  it("denies a banned staff member and a suspended staff organization", async () => {
    h.ctx = ctx("super_admin", { userBanned: true });
    await expect(requireStaff("enquiry:read")).rejects.toThrow("NOT_FOUND");
    h.ctx = ctx("super_admin", { orgStatus: "SUSPENDED" });
    await expect(requireStaff("enquiry:read")).rejects.toThrow("NOT_FOUND");
  });
  it("allows any staff member into the admin shell when no permission is required", async () => {
    h.ctx = ctx("hr_manager");
    await expect(requireStaff()).resolves.toBeTruthy();
  });
  it("super_admin can write settings; content_manager can read but not write", async () => {
    h.ctx = ctx("super_admin");
    await expect(requireStaff("site:settings:write")).resolves.toBeTruthy();
    h.ctx = ctx("content_manager");
    await expect(requireStaff("site:settings:read")).resolves.toBeTruthy();
    await expect(requireStaff("site:settings:write")).rejects.toThrow("NOT_FOUND");
  });
});
