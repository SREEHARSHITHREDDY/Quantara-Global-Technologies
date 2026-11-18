import { describe, expect, it } from "vitest";
import { employmentLabel, linesOf, makeApplicationReference, slugify } from "./careers";

describe("careers helpers", () => {
  it("slugify makes URL-safe slugs", () => {
    expect(slugify("Senior AI Engineer (Hyderabad) — Quantum!")).toBe("senior-ai-engineer-hyderabad-quantum");
    expect(slugify("  Café Ünïcode  ")).toBe("cafe-unicode"); expect(slugify("!!!")).toBe("");
  });
  it("linesOf trims, drops blanks and caps length and count", () => {
    expect(linesOf("  a \n\n b\r\n c ")).toEqual(["a", "b", "c"]);
    expect(linesOf(Array.from({ length: 50 }, (_, i) => `l${i}`).join("\n"))).toHaveLength(30);
    expect(linesOf("x".repeat(500))[0]).toHaveLength(300);
  });
  it("application references look like QNT-APP-YYYYMMDD-XXXXXX", () => {
    expect(makeApplicationReference(new Date("2026-11-18T00:00:00Z"))).toMatch(/^QNT-APP-20261118-[A-Z2-9]{6}$/);
  });
  it("employmentLabel is readable", () => { expect(employmentLabel("FULL_TIME")).toBe("Full time"); });
});
