import { describe, it, expect } from "vitest";
import { services, industries, marketStatistics, sources, company, coreValues, approachSteps, whyQuantara, requiredSiteSettings } from "./index";

describe("profile-derived content integrity", () => {
  it("has exactly the 9 service routes and 10 industry routes from the brief", () => {
    expect(services.map((s) => s.slug).sort()).toEqual([
      "artificial-intelligence","cloud-platform-engineering","cybersecurity","data-analytics","datacenter-infrastructure",
      "digital-engineering","enterprise-applications","gcc-advisory","quantum-computing"]);
    expect(industries.map((i) => i.slug).sort()).toEqual([
      "automotive","banking-financial-services","energy-utilities","global-capability-centers","government-public-sector",
      "healthcare-life-sciences","logistics-supply-chain","manufacturing","retail-consumer-goods","telecommunications"]);
  });
  it("preserves profile capability counts (6,8,7,8,4,4,4,3,4 = 48)", () => {
    const counts = Object.fromEntries(services.map((s) => [s.slug, s.capabilities.length]));
    expect(counts).toMatchObject({ "artificial-intelligence": 6, "quantum-computing": 8, "gcc-advisory": 7, "datacenter-infrastructure": 8,
      "cloud-platform-engineering": 4, "data-analytics": 4, "digital-engineering": 4, "enterprise-applications": 3, cybersecurity: 4 });
    expect(services.reduce((n, s) => n + s.capabilities.length, 0)).toBe(48);
  });
  it("has 6 values, 5 approach steps and 8 why-Quantara pillars", () => {
    expect(coreValues).toHaveLength(6); expect(approachSteps).toHaveLength(5); expect(whyQuantara).toHaveLength(8);
  });
  it("uses exact profile taglines", () => {
    expect(company.tagline).toBe("Engineering Intelligent Enterprises for the AI & Quantum Era");
    expect(company.supportingTagline).toBe("Transform Faster. Innovate Smarter. Lead Confidently.");
  });
  it("has unique slugs and valid cross references", () => {
    const sSlugs = new Set(services.map((s) => s.slug)); const iSlugs = new Set(industries.map((i) => i.slug));
    expect(sSlugs.size).toBe(services.length); expect(iSlugs.size).toBe(industries.length);
    for (const s of services) {
      s.relatedServiceSlugs.forEach((r) => { expect(sSlugs.has(r)).toBe(true); expect(r).not.toBe(s.slug); });
      s.relatedIndustrySlugs.forEach((r) => expect(iSlugs.has(r)).toBe(true));
      expect(s.businessChallenges.length).toBeGreaterThan(0); expect(s.enterpriseApplications.length).toBeGreaterThan(0);
    }
    for (const i of industries) i.relatedServiceSlugs.forEach((r) => expect(sSlugs.has(r)).toBe(true));
  });
  it("does not invent clients, awards, certifications, offices or performance claims", () => {
    const blob = JSON.stringify({ services, industries, company, coreValues, whyQuantara }).toLowerCase();
    for (const banned of ["fortune 500 clients", "award-winning", "iso 27001 certified", "our clients include", "testimonial", "years of experience", "headquartered", "offices in", "customers worldwide"]) {
      expect(blob).not.toContain(banned);
    }
  });
  it("has no hardcoded contact details (emails/phones/addresses)", () => {
    const blob = JSON.stringify({ services, industries, company });
    expect(blob).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(blob).not.toMatch(/\+\d[\d\s-]{8,}/);
    expect(requiredSiteSettings).toContain("contact.email");
  });
});

describe("market statistics traceability", () => {
  const byKey = new Map(sources.map((s) => [s.key, s]));
  it("every source has a valid ISO publication date, https URL, publisher", () => {
    for (const s of sources) {
      expect(s.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(Number.isNaN(Date.parse(s.publishedAt))).toBe(false);
      expect(s.url.startsWith("https://")).toBe(true); expect(s.publisher.length).toBeGreaterThan(0);
    }
  });
  it("every statistic with a sourceKey resolves to a real source", () => {
    for (const m of marketStatistics) if (m.sourceKey) expect(byKey.has(m.sourceKey)).toBe(true);
  });
  it("statistics without a source are explicitly marked as unsourced profile claims", () => {
    const unsourced = marketStatistics.filter((m) => !m.sourceKey);
    expect(unsourced.length).toBeGreaterThan(0);
    for (const m of unsourced) expect(m.statement).toMatch(/unsourced/i);
  });
  it("no statistic statement attributes market figures to Quantara", () => {
    for (const m of marketStatistics) expect(m.statement).not.toMatch(/\b(we|our|quantara)\b.*\b\d/i);
  });
});
