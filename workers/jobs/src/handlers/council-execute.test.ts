import { describe, expect, it } from "vitest";
import { FREE_RATE, MemoryStore, MockProvider, type MockScenario } from "@quantara/council";
import { createCouncilHandler, type CouncilHandlerDeps } from "./council-execute";

const ctx = (attempt = 1) => ({ jobId: "j", attempt, signal: new AbortController().signal });
const payload = { executionId: "exec-1", organizationId: "org-1" };

function setup(over: Partial<CouncilHandlerDeps> = {}, scenario: MockScenario = "success", store = new MemoryStore()) {
  const failed: { error: string }[] = [];
  const deps: CouncilHandlerDeps = {
    loadRun: async () => ({ participants: ["CEO", "CFO", "CTO", "NOPE"], providerKey: "mock" }),
    makeStore: () => store,
    makeProvider: (k) => (k === "mock" ? { provider: new MockProvider(scenario), rate: FREE_RATE } : null),
    fail: async (_e, _o, error) => { failed.push({ error }); },
    ...over,
  };
  return { handler: createCouncilHandler(deps), store, failed };
}

describe("council.execute handler", () => {
  it("runs the stored participants (ignoring unknown codes) and finishes the execution", async () => {
    const { handler, store } = setup();
    await handler(payload, ctx());
    expect(store.record.status).toBe("SUCCEEDED");
    expect(store.tasks.map((t) => t.agent).sort()).toEqual(["CEO", "CFO", "CTO"]);
  });
  it("does nothing when the execution is not found", async () => {
    const { handler, store, failed } = setup({ loadRun: async () => null });
    await handler(payload, ctx());
    expect(store.record.status).toBe("QUEUED"); expect(failed).toEqual([]);
  });
  it("fails the execution (not the job) when the provider is unavailable", async () => {
    const { handler, failed } = setup({ loadRun: async () => ({ participants: ["CFO", "CTO"], providerKey: "anthropic" }) });
    await handler(payload, ctx());
    expect(failed).toEqual([{ error: "provider_unavailable" }]);
  });
  it("a crash on the first attempt is retried without ending the execution; on the last attempt it is ended", async () => {
    const boom = { makeStore: () => { throw new Error("db down"); } };
    const first = setup(boom);
    await expect(first.handler(payload, ctx(1))).rejects.toThrow("db down");
    expect(first.failed).toEqual([]);
    const last = setup(boom);
    await expect(last.handler(payload, ctx(2))).rejects.toThrow("db down");
    expect(last.failed).toEqual([{ error: "worker_error" }]);
  });
  it("passes the job's abort signal through so a shutdown stops the run", async () => {
    const { handler, store } = setup();
    const c = new AbortController(); c.abort();
    await handler(payload, { jobId: "j", attempt: 1, signal: c.signal });
    expect(store.record.status).toBe("CANCELLED");
  });
  it("a simulated provider is labelled in the stored result", async () => {
    const { handler, store } = setup({}, "disagreement");
    await handler(payload, ctx());
    expect(store.result?.label).toBe("SIMULATED ANALYSIS");
  });
});
