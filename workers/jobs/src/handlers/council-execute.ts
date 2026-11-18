import { AGENT_CODES, runExecution, type AgentCode, type ExecutionStore, type LlmProvider, type Rate } from "@quantara/council";
import type { Handler } from "../worker";

export interface CouncilHandlerDeps {
  /** Reads what the start request stored. Null when the execution does not exist in that organization. */
  loadRun(executionId: string, organizationId: string): Promise<{ participants: string[]; providerKey: string | null } | null>;
  makeStore(organizationId: string): ExecutionStore;
  /** Null when the provider is not available (no adapter, or not allowed in this environment). */
  makeProvider(key: string | null): { provider: LlmProvider; rate: Rate } | null;
  /** Marks an unfinished execution FAILED so its budget reservation is released. */
  fail(executionId: string, organizationId: string, error: string): Promise<void>;
  agentTimeoutMs?: number;
  log?: (msg: string, extra?: object) => void;
}

/** Retry limit is 1, so attempt 2 is the last. */
const LAST_ATTEMPT = 2;

export function createCouncilHandler(deps: CouncilHandlerDeps): Handler<"council.execute"> {
  return async ({ executionId, organizationId }, ctx) => {
    const log = deps.log ?? (() => {});
    const run = await deps.loadRun(executionId, organizationId);
    if (!run) { log("council execution not found; nothing to do", { executionId }); return; }
    const made = deps.makeProvider(run.providerKey);
    if (!made) { await deps.fail(executionId, organizationId, "provider_unavailable"); log("provider unavailable", { executionId, provider: run.providerKey }); return; }
    const participants = run.participants.filter((c): c is AgentCode => (AGENT_CODES as readonly string[]).includes(c));
    try {
      const out = await runExecution(
        executionId,
        { participants, rate: made.rate, agentTimeoutMs: made.provider.simulated ? undefined : deps.agentTimeoutMs },
        { provider: made.provider, store: deps.makeStore(organizationId) },
        ctx.signal,
      );
      log("council execution finished", { executionId, status: out.status, budgetExhausted: out.budgetExhausted });
    } catch (e) {
      // Unexpected failure. A retry resumes from saved progress; after the last attempt, end the execution so it does not hang.
      if (ctx.attempt >= LAST_ATTEMPT) await deps.fail(executionId, organizationId, "worker_error");
      throw e;
    }
  };
}
