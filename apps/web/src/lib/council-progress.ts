/** Pure reducer: council events in, a display-ready progress model out. No React, no network. */
export type AgentProgress = { state: "waiting" | "working" | "done" | "failed" | "skipped"; stance?: string; confidence?: number; reason?: string };
export interface CouncilEventLike { seq: number; type: string; agent?: string | null; data?: Record<string, unknown> | null }
export interface Progress {
  lastSeq: number;
  stage: string | null;
  participants: string[];
  agents: Record<string, AgentProgress>;
  disagreements: { topic: string; agents: string[] }[];
  consolidated: boolean;
  ended: boolean;
  endStatus: string | null;
}

export const initialProgress = (): Progress => ({ lastSeq: 0, stage: null, participants: [], agents: {}, disagreements: [], consolidated: false, ended: false, endStatus: null });

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export const STAGE_LABELS: Record<string, string> = {
  QUEUED: "Waiting for a free slot", CLASSIFYING: "Framing the question", ASSESSING: "Executives are assessing",
  REVIEWING: "Reviewing the assessments", CONSOLIDATING: "The CEO is consolidating",
  SUCCEEDED: "Complete", PARTIALLY_SUCCEEDED: "Complete, with gaps", FAILED: "Failed", CANCELLED: "Cancelled", TIMED_OUT: "Timed out",
};

/** Events can be replayed after a reconnect, so anything at or below lastSeq is ignored. */
export function applyEvent(p: Progress, e: CouncilEventLike): Progress {
  if (e.seq <= p.lastSeq) return p;
  const next: Progress = { ...p, lastSeq: e.seq, agents: { ...p.agents }, disagreements: [...p.disagreements] };
  const d = e.data ?? {};
  const agent = e.agent ?? undefined;
  const set = (a: string | undefined, v: AgentProgress) => { if (a) next.agents[a] = { ...(next.agents[a] ?? { state: "waiting" }), ...v }; };
  switch (e.type) {
    case "state.changed": next.stage = str(d.state) ?? next.stage; break;
    case "participants.selected": {
      const list = Array.isArray(d.participants) ? d.participants.filter((x): x is string => typeof x === "string") : [];
      next.participants = list;
      for (const a of list) if (!next.agents[a]) next.agents[a] = { state: "waiting" };
      break;
    }
    case "agent.started": set(agent, { state: "working" }); break;
    case "agent.completed": set(agent, { state: "done", stance: str(d.stance), confidence: num(d.confidence) }); break;
    case "agent.failed": set(agent, { state: "failed", reason: str(d.reason) }); break;
    case "agent.skipped": set(agent, { state: "skipped", reason: str(d.reason) }); break;
    case "disagreement.detected": next.disagreements.push({ topic: str(d.topic) ?? "Disagreement", agents: Array.isArray(d.agents) ? d.agents.filter((x): x is string => typeof x === "string") : [] }); break;
    case "consolidation.completed": next.consolidated = true; break;
    case "end": next.ended = true; next.endStatus = str(d.status) ?? str(d.reason) ?? null; break;
  }
  return next;
}
