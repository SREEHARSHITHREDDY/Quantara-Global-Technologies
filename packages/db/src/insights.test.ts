import { describe, expect, it } from "vitest";
import { parseTags, publishedWhere } from "./insights";

describe("insights helpers", () => {
  it("parseTags trims, collapses spaces, de-duplicates and caps", () => {
    expect(parseTags(" AI ,  quantum  computing, AI,, ")).toEqual(["AI", "quantum computing"]);
    expect(parseTags(Array.from({ length: 20 }, (_, i) => `t${i}`).join(","))).toHaveLength(10);
    expect(parseTags("x".repeat(100))[0]).toHaveLength(40);
  });
  it("publishedWhere only matches published articles whose date has arrived", () => {
    const now = new Date("2026-11-18T00:00:00Z");
    expect(publishedWhere(now)).toEqual({ status: "PUBLISHED", publishedAt: { lte: now } });
  });
});
