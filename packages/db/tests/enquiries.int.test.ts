// Runs against the throw-away database (pnpm test:db). Unverified until run on a machine with PostgreSQL.
import { describe, expect, it } from "vitest";
import { createEnquiry, hitRateLimit, type NewEnquiry } from "../src/enquiries";
import { db, id } from "./helpers";

const base = (o: Partial<NewEnquiry> = {}): NewEnquiry => ({
  fullName: "Test Person", businessEmail: "person@example.test", organization: "Org", jobDesignation: "CTO", country: "India",
  projectRequirements: "We want to modernise our platform.", consentTextVersion: "v1", spamScore: 0, status: "RECEIVED", ...o,
});

describe("createEnquiry", () => {
  it("stores an enquiry with a reference id and recorded consent", async () => {
    const r = await createEnquiry(db, base());
    expect(r.duplicate).toBe(false);
    const row = await db.contactEnquiry.findUniqueOrThrow({ where: { referenceId: r.referenceId } });
    expect(row.privacyConsent).toBe(true);
    expect(row.consentTextVersion).toBe("v1");
    expect(row.status).toBe("RECEIVED");
  });
  it("links a known service and industry by slug", async () => {
    const r = await createEnquiry(db, base({ serviceSlug: "artificial-intelligence", industrySlug: "manufacturing" }));
    const row = await db.contactEnquiry.findUniqueOrThrow({ where: { referenceId: r.referenceId }, include: { service: true, industry: true } });
    expect(row.service?.slug).toBe("artificial-intelligence");
    expect(row.industry?.slug).toBe("manufacturing");
  });
  it("absorbs a repeated idempotency key, including concurrent submits", async () => {
    const key = id("idem");
    const [a, b] = await Promise.all([createEnquiry(db, base({ idempotencyKey: key })), createEnquiry(db, base({ idempotencyKey: key }))]);
    expect(b.referenceId).toBe(a.referenceId);
    expect(await db.contactEnquiry.count({ where: { idempotencyKey: key } })).toBe(1);
    expect((await createEnquiry(db, base({ idempotencyKey: key }))).duplicate).toBe(true);
  });
  it("records spam-flagged submissions with SPAM status", async () => {
    const r = await createEnquiry(db, base({ status: "SPAM", spamScore: 100 }));
    expect((await db.contactEnquiry.findUniqueOrThrow({ where: { referenceId: r.referenceId } })).status).toBe("SPAM");
  });
  it("stores the email trimmed and lower-case", async () => {
    const r = await createEnquiry(db, base({ businessEmail: "  Person@Example.TEST " }));
    expect((await db.contactEnquiry.findUniqueOrThrow({ where: { referenceId: r.referenceId } })).businessEmail).toBe("person@example.test");
  });
});

describe("hitRateLimit", () => {
  it("allows up to the limit, then blocks, then allows again in the next window", async () => {
    const key = id("rl"); const t = new Date("2026-11-18T10:10:00Z");
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await hitRateLimit(db, key, 3600, 3, t)).allowed);
    expect(results).toEqual([true, true, true, false]);
    expect((await hitRateLimit(db, key, 3600, 3, new Date("2026-11-18T11:10:00Z"))).allowed).toBe(true);
  });
  it("counts concurrent hits atomically", async () => {
    const key = id("rl"); const t = new Date("2026-11-18T10:10:00Z");
    const r = await Promise.all(Array.from({ length: 10 }, () => hitRateLimit(db, key, 3600, 4, t)));
    expect(r.filter((x) => x.allowed).length).toBe(4);
  });
});
