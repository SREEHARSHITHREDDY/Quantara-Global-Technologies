import { describe, expect, it } from "vitest";
import { CSP_DIRECTIVES, securityHeaders } from "./security-headers";

const h = (k: string) => securityHeaders.find((x) => x.key === k)?.value;

describe("security headers", () => {
  it("sets the baseline headers", () => {
    expect(h("X-Content-Type-Options")).toBe("nosniff");
    expect(h("X-Frame-Options")).toBe("DENY");
    expect(h("Strict-Transport-Security")).toMatch(/max-age=\d{8,}/);
    expect(h("Referrer-Policy")).toBeTruthy();
    expect(h("Permissions-Policy")).toContain("camera=()");
  });
  it("the policy forbids framing, plugins, base-tag changes and cross-site form posts, and never allows eval", () => {
    const csp = h("Content-Security-Policy")!;
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) expect(csp).toContain(d);
    expect(csp).not.toContain("unsafe-eval");
    expect(CSP_DIRECTIVES.length).toBeGreaterThan(3);
  });
  it("does not set a default-src that would block the framework's own scripts before a nonce policy exists", () => {
    expect(h("Content-Security-Policy")).not.toContain("default-src");
  });
});
