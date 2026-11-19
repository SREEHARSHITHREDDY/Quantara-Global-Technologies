import { describe, expect, it } from "vitest";
import { PRIVATE_DISALLOW, isPrivatePath, publicPaths } from "./seo";

describe("seo", () => {
  it("lists the public pages and the service, industry and executive pages", () => {
    const p = publicPaths();
    expect(p).toContain("/");
    expect(p).toContain("/services");
    expect(p.some((x) => x.startsWith("/services/"))).toBe(true);
    expect(p.some((x) => x.startsWith("/executives/"))).toBe(true);
  });
  it("never lists sign-in, account, council, admin, staff or newsletter links", () => {
    for (const x of publicPaths()) expect(isPrivatePath(x), x).toBe(false);
    for (const x of ["/sign-in", "/account", "/council", "/council/approvals", "/admin/enquiries", "/staff", "/newsletter/confirm"]) expect(isPrivatePath(x)).toBe(true);
    expect(isPrivatePath("/councils-of-war")).toBe(false);
  });
  it("robots disallows every private area", () => {
    for (const d of ["/admin", "/staff", "/council", "/account"]) expect(PRIVATE_DISALLOW).toContain(d);
  });
});
