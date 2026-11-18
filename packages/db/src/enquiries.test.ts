import { describe, expect, it } from "vitest";
import { makeReferenceId, rateLimitWindowStart } from "./enquiries";

describe("enquiry helpers (no database)", () => {
  it("makes well-formed, effectively unique reference ids", () => {
    const now = new Date("2026-11-18T10:00:00Z");
    const ids = new Set(Array.from({ length: 500 }, () => makeReferenceId(now)));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^QNT-ENQ-20261118-[A-HJ-NP-Z2-9]{6}$/);
  });
  it("aligns rate-limit windows to fixed boundaries", () => {
    const a = rateLimitWindowStart(new Date("2026-11-18T10:07:30Z"), 3600);
    const b = rateLimitWindowStart(new Date("2026-11-18T10:59:59Z"), 3600);
    const c = rateLimitWindowStart(new Date("2026-11-18T11:00:00Z"), 3600);
    expect(a.toISOString()).toBe("2026-11-18T10:00:00.000Z");
    expect(b.getTime()).toBe(a.getTime());
    expect(c.getTime()).toBe(a.getTime() + 3600_000);
  });
});
