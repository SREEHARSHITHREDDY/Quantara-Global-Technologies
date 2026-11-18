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
  organizationId: string; userId: string;
  /** Omit to create a new conversation in the same transaction. */
  conversationId?: string; title?: string;
  mode: ConsultationMode; prompt: string;
  participants?: string[]; providerKey?: string | null; templateId?: string | null;
  estimate: { tokens: number; costUsd: number };
  /** From the organization's plan limits. */
  maxConcurrent: number;
  deadlineAt?: Date | null; maxIterations?: number; now?: Date;
}
export type ReserveResult =
  | { ok: true; executionId: string }
  | { ok: false; reason: "concurrency_limit" | "budget_exceeded" };

type ReserveTx = Pick<PrismaClient, "$queryRaw" | "organization" | "execution" | "usageRecord" | "conversation">;

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
    const conversationId: string = input.conversationId ?? (await tx.conversation.create({
      data: { organizationId: input.organizationId, userId: input.userId, title: clip(input.title ?? input.prompt, 80), mode: input.mode },
      select: { id: true },
    })).id;
    const e = await tx.execution.create({
      data: {
        organizationId: input.organizationId, userId: input.userId, conversationId,
        participants: input.participants ?? [], providerKey: input.providerKey ?? null, templateId: input.templateId ?? null,
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

// ---- reads, cleanup and plan management -------------------------------------------------------

export interface ExecutionView {
  id: string; organizationId: string; userId: string; status: ExecutionStatus; mode: ConsultationMode;
  prompt: string; participants: string[]; providerKey: string | null; templateId: string | null;
  error: string | null; tokensUsed: number; costUsd: number; reportReady: boolean;
  deadlineAt: Date | null; createdAt: Date; startedAt: Date | null; finishedAt: Date | null;
}
/** Returns the execution only if it belongs to the organization. The caller decides whether this user may read it. */
export async function getExecutionView(db: PrismaClient, executionId: string, organizationId: string): Promise<ExecutionView | null> {
  const e = await db.execution.findFirst({ where: { id: executionId, organizationId }, include: { report: { select: { status: true } } } });
  if (!e) return null;
  return {
    id: e.id, organizationId: e.organizationId, userId: e.userId, status: e.status, mode: e.mode, prompt: e.prompt,
    participants: e.participants, providerKey: e.providerKey, templateId: e.templateId, error: e.error,
    tokensUsed: e.tokensUsed, costUsd: num(e.costUsd), reportReady: e.report?.status === "READY",
    deadlineAt: e.deadlineAt, createdAt: e.createdAt, startedAt: e.startedAt, finishedAt: e.finishedAt,
  };
}

export async function getExecutionResult(db: PrismaClient, executionId: string, organizationId: string): Promise<unknown | null> {
  const r = await db.report.findFirst({ where: { executionId, organizationId, status: "READY" }, select: { sections: true } });
  return r?.sections ?? null;
}

export interface ExecutionEventRow { seq: number; type: string; agent: string | null; payload: unknown; createdAt: Date }
export async function listExecutionEvents(db: PrismaClient, a: { executionId: string; organizationId: string; afterSeq: number; limit?: number }): Promise<ExecutionEventRow[]> {
  const owns = await db.execution.count({ where: { id: a.executionId, organizationId: a.organizationId } });
  if (owns === 0) return [];
  const rows: { seq: number; type: string; agentKey: string | null; payload: unknown; createdAt: Date }[] = await db.agentEvent.findMany({
    where: { executionId: a.executionId, seq: { gt: a.afterSeq } }, orderBy: { seq: "asc" }, take: Math.min(a.limit ?? 200, 500),
  });
  return rows.map((r) => ({ seq: r.seq, type: r.type, agent: r.agentKey, payload: r.payload, createdAt: r.createdAt }));
}

/** Ends a stuck execution so its reservation is released. No effect if it already ended. */
export async function failExecution(db: PrismaClient, a: { executionId: string; organizationId: string; error: string }): Promise<boolean> {
  const r = await db.execution.updateMany({
    where: { id: a.executionId, organizationId: a.organizationId, status: { in: NON_TERMINAL } },
    data: { status: "FAILED", error: a.error, finishedAt: new Date() },
  });
  return r.count > 0;
}

/**
 * Safety net for executions whose worker died or whose job expired: past their deadline (plus grace) they become TIMED_OUT,
 * and anything older than `maxAgeMs` that is still unfinished becomes FAILED. Run periodically by the worker.
 */
export async function failStaleExecutions(db: PrismaClient, o: { now?: Date; graceMs?: number; maxAgeMs?: number } = {}): Promise<{ timedOut: number; failed: number }> {
  const now = o.now ?? new Date();
  const finishedAt = now;
  const timedOut = await db.execution.updateMany({
    where: { status: { in: NON_TERMINAL }, deadlineAt: { lt: new Date(now.getTime() - (o.graceMs ?? 5 * 60_000)) } },
    data: { status: "TIMED_OUT", error: "deadline_exceeded", finishedAt },
  });
  const failed = await db.execution.updateMany({
    where: { status: { in: NON_TERMINAL }, createdAt: { lt: new Date(now.getTime() - (o.maxAgeMs ?? 60 * 60_000)) } },
    data: { status: "FAILED", error: "abandoned", finishedAt },
  });
  return { timedOut: timedOut.count, failed: failed.count };
}

export interface CouncilOrgAccess { plan: "DISABLED" | "TRIAL" | "STANDARD" | "ENTERPRISE"; trialEndsAt: Date | null; maxConcurrentOverride: number | null }
export async function getCouncilOrgAccess(db: PrismaClient, organizationId: string): Promise<CouncilOrgAccess | null> {
  const o = await db.organization.findUnique({ where: { id: organizationId }, select: { councilPlan: true, councilTrialEndsAt: true, councilMaxConcurrent: true } });
  return o ? { plan: o.councilPlan, trialEndsAt: o.councilTrialEndsAt, maxConcurrentOverride: o.councilMaxConcurrent } : null;
}

/** Staff action: turns the Council on, off, or into a trial for one organization. Writes an audit entry. */
export async function setCouncilPlan(db: PrismaClient, a: { organizationId: string; plan: CouncilOrgAccess["plan"]; trialDays?: number; maxConcurrent?: number | null; actorId?: string | null; now?: Date }): Promise<{ trialEndsAt: Date | null }> {
  const now = a.now ?? new Date();
  if (a.plan === "TRIAL" && !(a.trialDays && a.trialDays > 0)) throw new Error("a trial needs a number of days");
  const trialEndsAt = a.plan === "TRIAL" ? new Date(now.getTime() + a.trialDays! * 86_400_000) : null;
  await db.organization.update({ where: { id: a.organizationId }, data: { councilPlan: a.plan, councilTrialEndsAt: trialEndsAt, ...(a.maxConcurrent !== undefined ? { councilMaxConcurrent: a.maxConcurrent } : {}) } });
  await db.auditLog.create({ data: { organizationId: a.organizationId, actorId: a.actorId ?? null, actorType: a.actorId ? "user" : "system", action: "council.plan.set", resourceType: "organization", resourceId: a.organizationId, metadata: { plan: a.plan, trialEndsAt: trialEndsAt?.toISOString() ?? null } } });
  return { trialEndsAt };
}

/** The customer workspace a user belongs to, looked up by email. For staff tooling. */
export async function findCustomerOrgByEmail(db: PrismaClient, email: string): Promise<{ organizationId: string; name: string } | null> {
  const m = await db.member.findFirst({ where: { user: { email: email.toLowerCase() }, organization: { type: "CLIENT" } }, select: { organizationId: true, organization: { select: { name: true } } } });
  return m ? { organizationId: m.organizationId, name: m.organization.name } : null;
}
