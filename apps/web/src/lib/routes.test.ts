import { existsSync } from "node:fs";
import { join } from "node:path";
import { industries, services } from "@quantara/content";
import { describe, expect, it } from "vitest";
import { LIVE_STATIC_ROUTES, MAIN_NAV, isLive, liveOnly } from "./routes";

const appDir = join(import.meta.dirname, "..", "app");
const pageFor = (route: string) => join(appDir, route === "/" ? "" : route, "page.tsx");

// Route list from the specification (Part 5).
const SERVICE_SLUGS = ["artificial-intelligence", "quantum-computing", "gcc-advisory", "datacenter-infrastructure", "cloud-platform-engineering", "data-analytics", "digital-engineering", "enterprise-applications", "cybersecurity"];
const INDUSTRY_SLUGS = ["manufacturing", "automotive", "banking-financial-services", "retail-consumer-goods", "healthcare-life-sciences", "telecommunications", "energy-utilities", "government-public-sector", "logistics-supply-chain", "global-capability-centers"];

describe("routes", () => {
  it("content slugs match the specified route list exactly", () => {
    expect(services.map((s) => s.slug).sort()).toEqual([...SERVICE_SLUGS].sort());
    expect(industries.map((i) => i.slug).sort()).toEqual([...INDUSTRY_SLUGS].sort());
  });
  it("every live static route has a page file", () => {
    for (const r of LIVE_STATIC_ROUTES) expect(existsSync(pageFor(r)), r).toBe(true);
  });
  it("dynamic service and industry pages exist", () => {
    expect(existsSync(join(appDir, "services", "[slug]", "page.tsx"))).toBe(true);
    expect(existsSync(join(appDir, "industries", "[slug]", "page.tsx"))).toBe(true);
  });
  it("every service and industry detail route is live; unknown ones are not", () => {
    for (const s of SERVICE_SLUGS) expect(isLive(`/services/${s}`)).toBe(true);
    for (const i of INDUSTRY_SLUGS) expect(isLive(`/industries/${i}`)).toBe(true);
    expect(isLive("/services/not-real")).toBe(false);
    expect(isLive("/contact")).toBe(true);
    expect(isLive("/careers")).toBe(true);
    expect(isLive("/insights")).toBe(true);
    expect(isLive("/council")).toBe(true);
    expect(isLive("/council/reports")).toBe(false); // not built yet
    expect(isLive("/executives")).toBe(true);
    expect(isLive("/executives/cfo")).toBe(true);
    expect(isLive("/executives/CFO")).toBe(false);
    expect(isLive("/executives/unknown")).toBe(false);
  });
  it("navigation never contains a link to a page that does not exist", () => {
    for (const item of liveOnly(MAIN_NAV)) expect(isLive(item.href), item.href).toBe(true);
  });
  it("every related slug in content resolves", () => {
    for (const s of services) {
      for (const r of s.relatedServiceSlugs) expect(SERVICE_SLUGS, `${s.slug} → ${r}`).toContain(r);
      for (const r of s.relatedIndustrySlugs) expect(INDUSTRY_SLUGS, `${s.slug} → ${r}`).toContain(r);
    }
    for (const i of industries) for (const r of i.relatedServiceSlugs) expect(SERVICE_SLUGS, `${i.slug} → ${r}`).toContain(r);
  });
});
