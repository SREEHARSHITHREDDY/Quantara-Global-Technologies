import type { ExecutionRecord, ExecutionStore, TaskRecord } from "./orchestrator";
import type { ConsolidatedResult } from "./consolidate";
import type { Disagreement } from "./schema";
import { assertTransition, type ExecutionState } from "./state-machine";

/** In-memory ExecutionStore for tests and local development. Enforces the same rules as the database store. */
export class MemoryStore implements ExecutionStore {
  record: ExecutionRecord;
  tasks: TaskRecord[] = [];
  events: { type: string; agent?: string; payload?: Record<string, unknown> }[] = [];
  disagreements: Disagreement[] = [];
  result: ConsolidatedResult | null = null;
  error: string | undefined;
  constructor(init: Partial<ExecutionRecord> = {}) {
    this.record = { id: "exec-1", organizationId: "org-1", status: "QUEUED", prompt: "Should we expand into a new region?", cancelRequested: false, deadlineAt: null, reservedTokens: 1_000_000, reservedCostUsd: 100, tokensUsed: 0, costUsd: 0, ...init };
  }
  async load() { return { ...this.record }; }
  async transition(_id: string, from: ExecutionState, to: ExecutionState, patch?: { error?: string }) {
    if (this.record.status !== from) throw new Error(`stale transition: expected ${from}, found ${this.record.status}`);
    assertTransition(from, to);
    this.record.status = to; if (patch?.error) this.error = patch.error;
  }
  async finishedTasks() { return [...this.tasks]; }
  async recordTask(_id: string, t: TaskRecord) {
    this.tasks = this.tasks.filter((x) => !(x.agent === t.agent && x.kind === t.kind && x.round === t.round)).concat(t);
    this.record.tokensUsed += t.usage.inputTokens + t.usage.outputTokens; this.record.costUsd += t.costUsd;
  }
  async appendEvent(_id: string, type: string, agent?: string, payload?: Record<string, unknown>) { this.events.push({ type, agent, payload }); }
  async saveDisagreements(_id: string, d: Disagreement[]) { this.disagreements = d; }
  async saveResult(_id: string, r: ConsolidatedResult) { this.result = r; }
}
