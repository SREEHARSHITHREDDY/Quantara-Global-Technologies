import { describe, expect, it } from "vitest";
import { applyEvent, initialProgress, type CouncilEventLike } from "./council-progress";

const run = (evs: CouncilEventLike[]) => evs.reduce(applyEvent, initialProgress());

describe("council progress reducer", () => {
  it("tracks participants and each agent through its states", () => {
    const p = run([
      { seq: 1, type: "participants.selected", data: { participants: ["CEO", "CFO"] } },
      { seq: 2, type: "state.changed", data: { state: "ASSESSING" } },
      { seq: 3, type: "agent.started", agent: "CFO" },
      { seq: 4, type: "agent.completed", agent: "CFO", data: { stance: "support", confidence: 0.8 } },
    ]);
    expect(p.stage).toBe("ASSESSING");
    expect(p.agents.CEO?.state).toBe("waiting");
    expect(p.agents.CFO).toMatchObject({ state: "done", stance: "support", confidence: 0.8 });
  });
  it("records failures, skips, disagreements and the end", () => {
    const p = run([
      { seq: 1, type: "agent.failed", agent: "CTO", data: { reason: "provider_timeout" } },
      { seq: 2, type: "agent.skipped", agent: "CMO", data: { reason: "budget" } },
      { seq: 3, type: "disagreement.detected", data: { topic: "Timing", agents: ["CFO", "COO"] } },
      { seq: 4, type: "consolidation.completed" },
      { seq: 5, type: "end", data: { status: "PARTIALLY_SUCCEEDED" } },
    ]);
    expect(p.agents.CTO).toMatchObject({ state: "failed", reason: "provider_timeout" });
    expect(p.agents.CMO?.state).toBe("skipped");
    expect(p.disagreements).toEqual([{ topic: "Timing", agents: ["CFO", "COO"] }]);
    expect(p.consolidated).toBe(true);
    expect(p.ended).toBe(true);
    expect(p.endStatus).toBe("PARTIALLY_SUCCEEDED");
  });
  it("ignores replayed events and never mutates its input", () => {
    const a = applyEvent(initialProgress(), { seq: 1, type: "disagreement.detected", data: { topic: "X", agents: [] } });
    const b = applyEvent(a, { seq: 1, type: "disagreement.detected", data: { topic: "X", agents: [] } });
    expect(b).toBe(a);
    expect(a.disagreements).toHaveLength(1);
    expect(initialProgress().disagreements).toHaveLength(0);
  });
  it("tolerates malformed data without throwing", () => {
    const p = run([{ seq: 1, type: "participants.selected", data: { participants: "nope" } }, { seq: 2, type: "agent.completed", agent: "CEO", data: { confidence: "high" } }, { seq: 3, type: "mystery" }]);
    expect(p.participants).toEqual([]);
    expect(p.agents.CEO?.confidence).toBeUndefined();
    expect(p.lastSeq).toBe(3);
  });
});
