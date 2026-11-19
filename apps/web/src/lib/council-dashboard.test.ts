import { describe, expect, it } from "vitest";
import { compact, percentOf, usd } from "./council-dashboard";

describe("council dashboard helpers", () => {
  it("percentOf clamps at 100 and returns null without a budget", () => {
    expect(percentOf(50, 200)).toBe(25);
    expect(percentOf(500, 200)).toBe(100);
    expect(percentOf(5, null)).toBeNull();
    expect(percentOf(5, 0)).toBeNull();
  });
  it("formats tokens and money", () => {
    expect(compact(999)).toBe("999");
    expect(compact(12_345)).toBe("12.3k");
    expect(compact(2_500_000)).toBe("2.5M");
    expect(usd(0.0123)).toBe("$0.0123");
    expect(usd(12.5)).toBe("$12.50");
  });
});
