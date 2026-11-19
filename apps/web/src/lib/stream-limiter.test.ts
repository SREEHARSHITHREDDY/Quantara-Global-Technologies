import { describe, expect, it } from "vitest";
import { createStreamLimiter } from "./stream-limiter";

describe("stream limiter", () => {
  it("allows up to the cap per key, refuses beyond it, and frees a slot on release", () => {
    const l = createStreamLimiter(2);
    const a = l.acquire("u1"), b = l.acquire("u1");
    expect(a && b).toBeTruthy();
    expect(l.acquire("u1")).toBeNull();
    expect(l.acquire("u2")).not.toBeNull();   // other users are unaffected
    a!();
    expect(l.acquire("u1")).not.toBeNull();
  });
  it("releasing twice does not free a second slot", () => {
    const l = createStreamLimiter(1);
    const r = l.acquire("u")!;
    r(); r();
    expect(l.acquire("u")).not.toBeNull();
    expect(l.acquire("u")).toBeNull();
    expect(l.count("u")).toBe(1);
  });
});
