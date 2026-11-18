import {
  DEFAULT_MONTHLY_BUDGET, EXECUTION_STATES, TERMINAL_STATES, assertTransition, assessmentSchema,
  type ConsolidatedResult, type Disagreement, type ExecutionRecord, type ExecutionState, type ExecutionStore, type TaskRecord,
} from "@quantara/council";
import type { PrismaClient } from "./generated/client";

type ConsultationMode = "INDIVIDUAL" | "MULTI_EXECUTIVE" | "FULL_COUNCIL" | "CEO_RECOMMENDATION";
type ExecutionStatus = "QUEUED" | "CLASSIFYING" | "ASSESSING" | "REVIEWING" | "CONSOLIDATING" | "RUNNING" | "AWAITING_APPROVAL" | "SUCCEEDED" | "PARTIALLY_SUCCEEDED" | "FAILED" | "CANCELLED" | "TIMED_OUT";

/** Every status an execution can hold before it ends. */
const NON_TERMINAL: ExecutionStatus[] = ["QUEUED", "CLASSIFYING", "ASSESSING", "REVIEWING", "CONSOLIDATING", "RUNNING", "AWAITING_APPROVAL"];
const TERMINAL = TERMINAL_STATES as unknown as ExecutionStatus[];
const json = (v: unknown) => JSON.parse(JSON.stringify(v));
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

export class StaleTransitionError extends Error {
  constructor(from: string, to: string) { super(`execution is no longer in state ${from}; cannot move to ${to}`); this.name = "StaleTransitionError"; }
}

export interface ReserveInput {
  organizationId: string; userId: string; conversationId: string;
  mode: ConsultationMode; prompt: string;
  estimate: { tokens: number; costUsd: number };
  /** From the organization's plan limits. */
  maxConcurrent: number;
  deadlineAt?: Date | null; maxIterations?: number; now?: Date;
}
export type ReserveResult =
  | { ok: true; executionId: string }
  | { ok: false; reason: "concurrency_limit" | "budget_exceeded" };

type ReserveTx = Pick<PrismaClient, "$queryRaw" | "organization" | "execution" | "usageRecord">;

/**
 * Creates a QUEUED execution only if the organization has concurrency and monthly budget left.
 * The organization row is locked for the check, so parallel requests cannot both pass on the same remaining budget.
 * The reservation counts against the budget until the execution ends; after that only actual usage counts.
 */
export async function reserveExecution(db: PrismaClient, input: ReserveInput): Promise<ReserveResult> {
  const now = input.now ?? new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return db.$transaction(async (tx: ReserveTx): Promise<ReserveResult> => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "organization" WHERE id = ${input.organizationId} FOR UPDATE`;
    if (locked.length === 0) throw new Error("organization not found");
    const org = await tx.organization.findUnique({ where: { id: input.organizationId }, select: { monthlyTokenBudget: true, monthlyCostBudgetUsd: true } });
    const budget = {
      tokens: org?.monthlyTokenBudget ?? DEFAULT_MONTHLY_BUDGET.tokens,
      costUsd: org?.monthlyCostBudgetUsd == null ? DEFAULT_MONTHLY_BUDGET.costUsd : num(org.monthlyCostBudgetUsd),
    };
    const active: { reservedTokens: number; tokensUsed: number; reservedCostUsd: unknown; costUsd: unknown }[] = await tx.execution.findMany({
      where: { organizationId: input.organizationId, status: { in: NON_TERMINAL } },
      select: { reservedTokens: true, tokensUsed: true, reservedCostUsd: true, costUsd: true },
    });
    if (active.length >= input.maxConcurrent) return { ok: false, reason: "concurrency_limit" };
    const spent = await tx.usageRecord.aggregate({
      where: { organizationId: input.organizationId, createdAt: { gte: monthStart } },
      _sum: { tokensIn: true, tokensOut: true, costUsd: true },
    });
    const usedTokens = num(spent._sum.tokensIn) + num(spent._sum.tokensOut);
    const usedCost = num(spent._sum.costUsd);
    // Reserved but not yet spent by executions still running.
    const pendingTokens = active.reduce((s, e) => s + Math.max(e.reservedTokens - e.tokensUsed, 0), 0);
    const pendingCost = active.reduce((s, e) => s + Math.max(num(e.reservedCostUsd) - num(e.costUsd), 0), 0);
    if (usedTokens + pendingTokens + input.estimate.tokens > budget.tokens) return { ok: false, reason: "budget_exceeded" };
    if (usedCost + pendingCost + input.estimate.costUsd > budget.costUsd + 1e-9) return { ok: false, reason: "budget_exceeded" };
    const e = await tx.execution.create({
      data: {
        organizationId: input.organizationId, userId: input.userId, conversationId: input.conversationId,
        mode: input.mode, prompt: input.prompt, status: "QUEUED",
        // the database requires a positive cost budget, even when the provider is free
        tokenBudget: input.estimate.tokens, costBudgetUsd: Math.max(input.estimate.costUsd, 0.000001).toFixed(6),
        reservedTokens: input.estimate.tokens, reservedCostUsd: input.estimate.costUsd.toFixed(6),
        deadlineAt: input.deadlineAt ?? null, ...(input.maxIterations ? { maxIterations: input.maxIterations } : {}),
      },
      select: { id: true },
    });
    return { ok: true, executionId: e.id };
  });
}

/** Marks a cancel request. A queued execution is cancelled at once; a running one stops at its next check. */
export async function requestCancel(db: PrismaClient, a: { executionId: string; organizationId: string; userId: string }): Promise<{ found: boolean }> {
  const where = { id: a.executionId, organizationId: a.organizationId, userId: a.userId, status: { in: NON_TERMINAL } };
  const r = await db.execution.updateMany({ where, data: { cancelRequestedAt: new Date() } });
  if (r.count === 0) return { found: false };
  await db.execution.updateMany({ where: { id: a.executionId, organizationId: a.organizationId, status: "QUEUED" }, data: { status: "CANCELLED", finishedAt: new Date(), error: "cancelled" } });
  return { found: true };
}

type EventTx = Pick<PrismaClient, "$queryRaw" | "agentEvent">;
type TaskTx = Pick<PrismaClient, "agentTask" | "usageRecord" | "execution">;
type ConflictTx = Pick<PrismaClient, "conflict">;

/** Postgres implementation of the council's ExecutionStore. Every query is scoped to one organization. */
export function createExecutionStore(db: PrismaClient, organizationId: string): ExecutionStore {
  let agentIds: Map<string, string> | null = null;
  const agentId = async (key: string): Promise<string> => {
    if (!agentIds) {
      const rows: { id: string; key: string }[] = await db.agent.findMany({ select: { id: true, key: true } });
      agentIds = new Map(rows.map((r) => [r.key, r.id]));
    }
    const id = agentIds.get(key);
    if (!id) throw new Error(`agent ${key} is not seeded`);
    return id;
  };
  const owned = async (id: string) => {
    const e = await db.execution.findFirst({ where: { id, organizationId } });
    if (!e) throw new Error("execution not found");
    return e;
  };

  return {
    async load(id: string): Promise<ExecutionRecord> {
      const e = await owned(id);
      if (!(EXECUTION_STATES as readonly string[]).includes(e.status)) throw new Error(`unsupported execution status ${e.status}`);
      return {
        id: e.id, organizationId: e.organizationId, status: e.status as ExecutionState, prompt: e.prompt,
        cancelRequested: e.cancelRequestedAt != null, deadlineAt: e.deadlineAt,
        reservedTokens: e.reservedTokens, reservedCostUsd: num(e.reservedCostUsd), tokensUsed: e.tokensUsed, costUsd: num(e.costUsd),
      };
    },

    async transition(id: string, from: ExecutionState, to: ExecutionState, patch?: { error?: string }): Promise<void> {
      assertTransition(from, to);
      const terminal = (TERMINAL as string[]).includes(to);
      const r = await db.execution.updateMany({
        where: { id, organizationId, status: from },
        data: { status: to, ...(from === "QUEUED" ? { startedAt: new Date() } : {}), ...(terminal ? { finishedAt: new Date() } : {}), ...(patch?.error ? { error: patch.error } : {}) },
      });
      if (r.count === 0) throw new StaleTransitionError(from, to);
    },

    async finishedTasks(id: string): Promise<TaskRecord[]> {
      await owned(id);
      const rows = await db.agentTask.findMany({ where: { executionId: id, kind: { in: ["ASSESS", "CONSOLIDATE"] } }, include: { agent: { select: { key: true } } } });
      const out: TaskRecord[] = [];
      for (const r of rows) {
        if (r.status === "PENDING" || r.status === "RUNNING") continue;
        const parsed = r.output == null ? null : assessmentSchema.safeParse(r.output);
        out.push({
          agent: r.agent.key, kind: r.kind as "ASSESS" | "CONSOLIDATE", round: r.round, status: r.status,
          assessment: parsed?.success ? parsed.data : undefined, error: r.error ?? undefined, attempts: r.attempt,
          provider: r.provider ?? "", model: r.model ?? "", usage: { inputTokens: r.tokensIn, outputTokens: r.tokensOut },
          costUsd: num(r.costUsd), latencyMs: r.latencyMs ?? 0,
        });
      }
      return out;
    },

    async recordTask(id: string, t: TaskRecord): Promise<void> {
      const e = await owned(id);
      const aid = await agentId(t.agent);
      const now = new Date();
      const data = {
        status: t.status, output: t.assessment ? json(t.assessment) : undefined, error: t.error ?? null, attempt: Math.max(t.attempts, 1),
        provider: t.provider || null, model: t.model || null, tokensIn: t.usage.inputTokens, tokensOut: t.usage.outputTokens,
        costUsd: t.costUsd.toFixed(6), latencyMs: t.latencyMs, finishedAt: now,
      };
      await db.$transaction(async (tx: TaskTx) => {
        const task = await tx.agentTask.upsert({
          where: { executionId_agentId_kind_round: { executionId: id, agentId: aid, kind: t.kind, round: t.round } },
          create: { executionId: id, agentId: aid, kind: t.kind, round: t.round, startedAt: now, ...data },
          update: data,
          select: { id: true },
        });
        const tokens = t.usage.inputTokens + t.usage.outputTokens;
        if (tokens > 0) {
          await tx.usageRecord.create({ data: { organizationId, userId: e.userId, executionId: id, agentTaskId: task.id, provider: t.provider, model: t.model, tokensIn: t.usage.inputTokens, tokensOut: t.usage.outputTokens, costUsd: t.costUsd.toFixed(6) } });
          await tx.execution.update({ where: { id }, data: { tokensUsed: { increment: tokens }, costUsd: { increment: t.costUsd.toFixed(6) } } });
        }
      });
    },

    async appendEvent(id: string, type: string, agent?: string, payload?: Record<string, unknown>): Promise<void> {
      await db.$transaction(async (tx: EventTx) => {
        const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Execution" WHERE id = ${id} AND "organizationId" = ${organizationId} FOR UPDATE`;
        if (locked.length === 0) throw new Error("execution not found");
        const last = await tx.agentEvent.aggregate({ where: { executionId: id }, _max: { seq: true } });
        await tx.agentEvent.create({ data: { executionId: id, seq: (last._max.seq ?? 0) + 1, type, agentKey: agent ?? null, payload: payload ? json(payload) : undefined } });
      });
    },

    async saveDisagreements(id: string, d: Disagreement[]): Promise<void> {
      await owned(id);
      await db.$transaction(async (tx: ConflictTx) => {
        await tx.conflict.deleteMany({ where: { executionId: id } });
        if (d.length === 0) return;
        await tx.conflict.createMany({
          data: d.map((x) => ({
            executionId: id, topic: x.topic, agentKeys: x.positions.map((p) => p.agent),
            description: x.positions.map((p) => `${p.agent}: ${p.recommendation}`).join(" | "),
            severity: "MEDIUM" as const, status: "OPEN" as const, resolution: x.resolved ? (x.resolution ?? null) : null,
          })),
        });
      });
    },

    async saveResult(id: string, r: ConsolidatedResult): Promise<void> {
      const e = await owned(id);
      const data = { title: `Consultation: ${clip(e.prompt, 80)}`, status: "READY" as const, sections: json(r), confidenceLevel: String(r.overallConfidence) };
      await db.report.upsert({ where: { executionId: id }, create: { organizationId, userId: e.userId, executionId: id, ...data }, update: data });
    },
  };
}
