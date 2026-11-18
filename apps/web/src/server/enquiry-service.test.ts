import { describe, expect, it } from "vitest";
import { LIMITS, processEnquiry, spamScore, type EnquiryDeps } from "./enquiry-service";
import type { NewEnquiry } from "@quantara/db";

const NOW = new Date("2026-11-18T10:00:00Z");
const valid = (o: Record<string, unknown> = {}) => ({
  fullName: "Asha Rao", businessEmail: "Asha@Example.com", organization: "Acme", jobDesignation: "CTO", country: "India",
  projectRequirements: "We want to modernise our data platform and adopt AI.", privacyConsent: "on",
  startedAt: String(NOW.getTime() - 30_000), idempotencyKey: "abcdef0123456789abcdef", website: "", ...o,
});
function fakes() {
  const stored: NewEnquiry[] = []; const hits = new Map<string, number>();
  const deps: EnquiryDeps = {
    ipSalt: "salt", now: () => NOW,
    async createEnquiry(i) { stored.push(i); return { referenceId: `QNT-ENQ-TEST-${stored.length}`, duplicate: false }; },
    async hitRateLimit(key, _w, limit) { const n = (hits.get(key) ?? 0) + 1; hits.set(key, n); return { allowed: n <= limit }; },
  };
  return { deps, stored };
}
const ctx = { ip: "203.0.113.7", userAgent: "test" };

describe("processEnquiry", () => {
  it("stores a valid enquiry, normalising the email, and returns the reference", async () => {
    const { deps, stored } = fakes();
    const r = await processEnquiry(valid(), ctx, deps);
    expect(r).toEqual({ status: "success", referenceId: "QNT-ENQ-TEST-1" });
    expect(stored[0]).toMatchObject({ businessEmail: "asha@example.com", status: "RECEIVED", spamScore: 0, consentTextVersion: "v1" });
    expect(stored[0]?.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored[0])).not.toContain("203.0.113.7"); // raw IP is never stored
  });
  it("requires explicit privacy consent", async () => {
    const { deps, stored } = fakes();
    const r = await processEnquiry(valid({ privacyConsent: undefined }), ctx, deps);
    expect(r).toMatchObject({ status: "error", fieldErrors: { privacyConsent: expect.any(Array) } });
    expect(stored).toHaveLength(0);
  });
  it.each([
    ["fullName", { fullName: "" }], ["businessEmail", { businessEmail: "not-an-email" }], ["organization", { organization: " " }],
    ["jobDesignation", { jobDesignation: "" }], ["country", { country: "" }], ["projectRequirements", { projectRequirements: "too short" }],
    ["phone", { phone: "abc" }], ["serviceSlug", { serviceSlug: "not-a-service" }], ["industrySlug", { industrySlug: "nope" }], ["engagementTimeline", { engagementTimeline: "someday" }],
  ])("rejects an invalid %s and stores nothing", async (field, patch) => {
    const { deps, stored } = fakes();
    const r = await processEnquiry(valid(patch), ctx, deps);
    expect(r.status).toBe("error");
    if (r.status === "error") expect(r.fieldErrors?.[field]).toBeDefined();
    expect(stored).toHaveLength(0);
  });
  it("accepts known service and industry slugs and optional fields", async () => {
    const { deps, stored } = fakes();
    const r = await processEnquiry(valid({ serviceSlug: "cybersecurity", industrySlug: "automotive", phone: "+91 98765 43210", engagementTimeline: "Within 3 months" }), ctx, deps);
    expect(r.status).toBe("success"); expect(stored[0]).toMatchObject({ serviceSlug: "cybersecurity", industrySlug: "automotive" });
  });
  it("stores honeypot hits as SPAM while showing the sender a normal success", async () => {
    const { deps, stored } = fakes();
    const r = await processEnquiry(valid({ website: "http://spam.test" }), ctx, deps);
    expect(r.status).toBe("success"); expect(stored[0]).toMatchObject({ status: "SPAM" });
  });
  it("flags instant submissions and link-stuffed text", () => {
    expect(spamScore({ startedAt: String(NOW.getTime() - 500) }, "x", NOW)).toBeGreaterThanOrEqual(LIMITS.spamThreshold);
    expect(spamScore({ startedAt: String(NOW.getTime() - 20_000) }, "http://a http://b http://c http://d", NOW)).toBeLessThan(LIMITS.spamThreshold);
    expect(spamScore({ startedAt: String(NOW.getTime() - 20_000) }, "plain text", NOW)).toBe(0);
  });
  it("rate-limits per IP", async () => {
    const { deps, stored } = fakes();
    const out = [];
    for (let i = 0; i < LIMITS.perIpPerHour + 1; i++) out.push((await processEnquiry(valid({ businessEmail: `u${i}@example.com` }), ctx, deps)).status);
    expect(out.slice(-1)).toEqual(["error"]); expect(stored).toHaveLength(LIMITS.perIpPerHour);
  });
  it("rate-limits per email across different IPs", async () => {
    const { deps, stored } = fakes();
    const out = [];
    for (let i = 0; i < LIMITS.perEmailPerHour + 1; i++) out.push((await processEnquiry(valid(), { ip: `198.51.100.${i}`, userAgent: "t" }, deps)).status);
    expect(out.slice(-1)).toEqual(["error"]); expect(stored).toHaveLength(LIMITS.perEmailPerHour);
  });
  it("does not leak server errors as field errors (store failure propagates to the caller)", async () => {
    const { deps } = fakes(); deps.createEnquiry = async () => { throw new Error("db down"); };
    await expect(processEnquiry(valid(), ctx, deps)).rejects.toThrow("db down");
  });
});
