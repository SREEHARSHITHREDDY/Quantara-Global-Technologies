import { AGENT_CODES } from "@quantara/council";
import { describe, expect, it } from "vitest";
import { EXECUTIVES, EXECUTIVE_GROUPS, getExecutive } from "./executives";

describe("executives", () => {
  it("covers all ten council agents exactly once", () => {
    expect(EXECUTIVES.map((e) => e.code).sort()).toEqual([...AGENT_CODES].sort());
    expect(EXECUTIVE_GROUPS.flatMap((g) => g.codes).sort()).toEqual([...AGENT_CODES].sort());
  });
  it("every executive has a unique tagline and a lowercase slug that resolves", () => {
    const lines = EXECUTIVES.map((e) => e.tagline);
    expect(lines.every((l) => l.length > 10)).toBe(true);
    expect(new Set(lines).size).toBe(10);
    for (const e of EXECUTIVES) expect(getExecutive(e.slug)?.code).toBe(e.code);
    expect(getExecutive("nope")).toBeUndefined();
    expect(getExecutive("CEO")).toBeUndefined(); // slugs are lowercase
  });
});
