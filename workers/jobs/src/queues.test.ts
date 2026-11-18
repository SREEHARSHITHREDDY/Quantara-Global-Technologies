import { describe, it, expect } from "vitest";
import { QUEUES, QUEUE_NAMES, deadLetterName } from "./queues";

describe("queue registry invariants", () => {
  it("every queue has a bounded timeout and bounded retries (no unlimited agent loops)", () => {
    for (const q of QUEUE_NAMES) { const o = QUEUES[q].options as { retryLimit: number; expireInSeconds: number }; expect(o.retryLimit).toBeLessThanOrEqual(5); expect(o.expireInSeconds).toBeLessThanOrEqual(1200); }
  });
  it("AI execution is retried at most once", () => { expect(QUEUES["council.execute"].options.retryLimit).toBeLessThanOrEqual(1); });
  it("payloads carry only identifiers, never user content", () => {
    expect(QUEUES["council.execute"].payload.safeParse({ executionId: "e", organizationId: "o", prompt: "secret" }).data).toEqual({ executionId: "e", organizationId: "o" });
  });
  it("rejects malformed payloads", () => {
    expect(QUEUES["council.execute"].payload.safeParse({}).success).toBe(false);
    expect(QUEUES["email.send"].payload.safeParse({ kind: "spam", outboxId: "x" }).success).toBe(false);
  });
  it("dead-letter names are distinct", () => { expect(new Set(QUEUE_NAMES.map(deadLetterName)).size).toBe(QUEUE_NAMES.length); });
});
