import { describe, expect, it } from "vitest";
import { AGENT_CODES, FREE_RATE, MockProvider, runExecution, type AgentCode, type MockScenario } from "@quantara/council";
import { createExecutionStore, requestCancel, reserveExecution } from "../src/council";
import { db, makeMember, makeOrg, makeUser } from "./helpers";

const ALL = [...AGENT_CODES] as AgentCode[];

async function tenant(budget?: { tokens?: number; cost?: string }) {
  const org = await makeOrg(); const user = await makeUser(); await makeMember(org.id, user.id);
  if (budget) await db.organization.update({ where: { id: org.id }, data: { monthlyTokenBudget: budget.tokens ?? null, monthlyCostBudgetUsd: budget.cost ?? null } });
  const conversation = await db.conversation.create({ data: { organizationId: org.id, userId: user.id, title: "t", mode: "FULL_COUNCIL" } });
  return { org, user, conversation };
}
const reserve = (t: Awaited<ReturnType<typeof tenant>>, tokens = 1000, maxConcurrent = 5, costUsd = 0) =>
  reserveExecution(db, { organizationId: t.org.id, userId: t.user.id, conversationId: t.conversation.id, mode: "FULL_COUNCIL", prompt: "Should we expand?", estimate: { tokens, costUsd }, maxConcurrent });
async function runIt(t: Awaited<ReturnType<typeof tenant>>, scenario: MockScenario, participants = ALL, tokens = 200_000) {
  const r = await reserve(t, tokens); if (!r.ok) throw new Error(r.reason);
  const store = createExecutionStore(db, t.org.id);
  const out = await runExecution(r.executionId, { participants, rate: FREE_RATE }, { provider: new MockProvider(scenario), store });
  return { out, id: r.executionId, store };
}

describe("reservation", () => {
  it("creates a queued execution that carries its reservation", async () => {
    const t = await tenant();
    const r = await reserve(t, 5000);
    expect(r.ok).toBe(true);
    const e = await db.execution.findFirstOrThrow({ where: { organizationId: t.org.id } });
    expect(e.status).toBe("QUEUED"); expect(e.reservedTokens).toBe(5000); expect(e.tokenBudget).toBe(5000);
    expect(Number(e.costBudgetUsd)).toBeGreaterThan(0);   // free provider still satisfies the positive-budget constraint
  });
  it("enforces the concurrency limit, and frees the slot when the execution ends", async () => {
    const t = await tenant();
    expect((await reserve(t, 100, 1)).ok).toBe(true);
    expect(await reserve(t, 100, 1)).toEqual({ ok: false, reason: "concurrency_limit" });
    const e = await db.execution.findFirstOrThrow({ where: { organizationId: t.org.id } });
    await requestCancel(db, { executionId: e.id, organizationId: t.org.id, userId: t.user.id });
    expect((await reserve(t, 100, 1)).ok).toBe(true);
  });
  it("parallel requests cannot overspend the monthly budget", async () => {
    const t = await tenant({ tokens: 10_000 });
    const results = await Promise.all(Array.from({ length: 6 }, () => reserve(t, 4000, 99)));
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.reason === "budget_exceeded")).toBe(true);
    expect(await db.execution.count({ where: { organizationId: t.org.id } })).toBe(2);
  });
  it("counts this month's usage, but not last month's", async () => {
    const t = await tenant({ tokens: 10_000 });
    const old = new Date(); old.setUTCMonth(old.getUTCMonth() - 2);
    await db.usageRecord.create({ data: { organizationId: t.org.id, provider: "mock", model: "m", tokensIn: 50_000, tokensOut: 0, costUsd: "0", createdAt: old } });
    expect((await reserve(t, 9000)).ok).toBe(true);
    const u = await tenant({ tokens: 10_000 });
    await db.usageRecord.create({ data: { organizationId: u.org.id, provider: "mock", model: "m", tokensIn: 8000, tokensOut: 1000, costUsd: "0" } });
    expect(await reserve(u, 1001)).toEqual({ ok: false, reason: "budget_exceeded" });
    expect((await reserve(u, 1000)).ok).toBe(true);
  });
  it("enforces the cost budget too", async () => {
    const t = await tenant({ tokens: 1_000_000, cost: "1.00" });
    expect((await reserve(t, 100, 5, 0.6)).ok).toBe(true);
    expect(await reserve(t, 100, 5, 0.6)).toEqual({ ok: false, reason: "budget_exceeded" });
  });
  it("one organization's reservations never affect another", async () => {
    const a = await tenant({ tokens: 1000 }); const b = await tenant({ tokens: 1000 });
    expect((await reserve(a, 1000)).ok).toBe(true);
    expect((await reserve(b, 1000)).ok).toBe(true);
  });
});

describe("execution against PostgreSQL", () => {
  it("full council: tasks, usage, events, report and state are consistent", async () => {
    const t = await tenant();
    const { out, id } = await runIt(t, "success");
    expect(out.status).toBe("SUCCEEDED");
    const e = await db.execution.findUniqueOrThrow({ where: { id } });
    expect(e.status).toBe("SUCCEEDED"); expect(e.startedAt).not.toBeNull(); expect(e.finishedAt).not.toBeNull();
    const tasks = await db.agentTask.findMany({ where: { executionId: id } });
    expect(tasks).toHaveLength(10); expect(tasks.every((x) => x.status === "SUCCEEDED")).toBe(true);
    const usage = await db.usageRecord.aggregate({ where: { executionId: id }, _sum: { tokensIn: true, tokensOut: true } });
    expect((usage._sum.tokensIn ?? 0) + (usage._sum.tokensOut ?? 0)).toBe(e.tokensUsed);
    expect(e.tokensUsed).toBeGreaterThan(0);
    const events = await db.agentEvent.findMany({ where: { executionId: id }, orderBy: { seq: "asc" } });
    expect(events.map((x) => x.seq)).toEqual(events.map((_, i) => i + 1));   // contiguous, even with parallel agents
    expect(events.at(-1)?.type).toBe("state.changed");
    expect(JSON.stringify(events)).not.toContain("Should we expand");
    const report = await db.report.findUniqueOrThrow({ where: { executionId: id } });
    expect(report.status).toBe("READY"); expect(report.userId).toBe(t.user.id);
    expect((report.sections as { label: string }).label).toBe("SIMULATED ANALYSIS");
  });
  it("disagreement is stored as a conflict row and in the report", async () => {
    const t = await tenant();
    const { id } = await runIt(t, "disagreement");
    const c = await db.conflict.findMany({ where: { executionId: id } });
    expect(c).toHaveLength(1); expect(c[0]!.status).toBe("OPEN"); expect(c[0]!.agentKeys).toContain("CFO");
  });
  it("partial failure ends PARTIALLY_SUCCEEDED and records the failed task", async () => {
    const t = await tenant();
    const { out, id } = await runIt(t, "agent_failure");
    expect(out.status).toBe("PARTIALLY_SUCCEEDED");
    const failed = await db.agentTask.findMany({ where: { executionId: id, status: "FAILED" }, include: { agent: true } });
    expect(failed.map((x) => x.agent.key)).toEqual(["CFO"]);
  });
  it("resuming a half-finished execution does not duplicate tasks or repeat finished agents", async () => {
    const t = await tenant();
    const { id } = await runIt(t, "agent_failure");
    await db.execution.update({ where: { id }, data: { status: "ASSESSING", finishedAt: null } });
    const store = createExecutionStore(db, t.org.id);
    const calls: string[] = []; const p = new MockProvider("success"); const orig = p.complete.bind(p);
    p.complete = async (r) => { calls.push(r.agentCode); return orig(r); };
    const out = await runExecution(id, { participants: ALL, rate: FREE_RATE }, { provider: p, store });
    expect(calls).toEqual(["CFO"]);
    expect(out.status).toBe("SUCCEEDED");
    expect(await db.agentTask.count({ where: { executionId: id } })).toBe(10);
    expect(await db.report.count({ where: { executionId: id } })).toBe(1);
  });
  it("budget exhaustion is recorded; skipped agents appear as SKIPPED tasks", async () => {
    const t = await tenant();
    const r = await reserve(t, 100_000); if (!r.ok) throw new Error();
    const out = await runExecution(r.executionId, { participants: ALL, rate: FREE_RATE, maxConcurrentAgents: 1 }, { provider: new MockProvider("budget_exhaustion"), store: createExecutionStore(db, t.org.id) });
    expect(out.budgetExhausted).toBe(true); expect(out.status).toBe("PARTIALLY_SUCCEEDED");
    expect(await db.agentTask.count({ where: { executionId: r.executionId, status: "SKIPPED" } })).toBeGreaterThan(5);
  });
  it("a queued execution can be cancelled before the worker starts, and the worker then does nothing", async () => {
    const t = await tenant();
    const r = await reserve(t); if (!r.ok) throw new Error();
    expect(await requestCancel(db, { executionId: r.executionId, organizationId: t.org.id, userId: t.user.id })).toEqual({ found: true });
    const calls: string[] = []; const p = new MockProvider(); const o = p.complete.bind(p); p.complete = async (x) => { calls.push(x.agentCode); return o(x); };
    const out = await runExecution(r.executionId, { participants: ALL, rate: FREE_RATE }, { provider: p, store: createExecutionStore(db, t.org.id) });
    expect(out.status).toBe("CANCELLED"); expect(calls).toHaveLength(0);
  });
  it("a cancel request during a run ends it CANCELLED", async () => {
    const t = await tenant();
    const r = await reserve(t); if (!r.ok) throw new Error();
    await db.execution.update({ where: { id: r.executionId }, data: { status: "ASSESSING", cancelRequestedAt: new Date() } });
    const out = await runExecution(r.executionId, { participants: ALL, rate: FREE_RATE }, { provider: new MockProvider(), store: createExecutionStore(db, t.org.id) });
    expect(out.status).toBe("CANCELLED");
  });
  it("only the owner can request cancellation", async () => {
    const t = await tenant(); const other = await makeUser();
    const r = await reserve(t); if (!r.ok) throw new Error();
    expect(await requestCancel(db, { executionId: r.executionId, organizationId: t.org.id, userId: other.id })).toEqual({ found: false });
    expect((await db.execution.findUniqueOrThrow({ where: { id: r.executionId } })).status).toBe("QUEUED");
  });
});

describe("store safety", () => {
  it("another organization's store cannot see or change an execution", async () => {
    const a = await tenant(); const b = await tenant();
    const r = await reserve(a); if (!r.ok) throw new Error();
    const foreign = createExecutionStore(db, b.org.id);
    await expect(foreign.load(r.executionId)).rejects.toThrow(/not found/);
    await expect(foreign.transition(r.executionId, "QUEUED", "CLASSIFYING")).rejects.toThrow(/no longer in state/);
    await expect(foreign.appendEvent(r.executionId, "x")).rejects.toThrow(/not found/);
    expect((await db.execution.findUniqueOrThrow({ where: { id: r.executionId } })).status).toBe("QUEUED");
  });
  it("rejects stale and illegal transitions", async () => {
    const t = await tenant(); const r = await reserve(t); if (!r.ok) throw new Error();
    const s = createExecutionStore(db, t.org.id);
    await expect(s.transition(r.executionId, "ASSESSING", "REVIEWING")).rejects.toThrow(/no longer in state/);
    await expect(s.transition(r.executionId, "QUEUED", "SUCCEEDED")).rejects.toThrow(/invalid execution transition/);
    await s.transition(r.executionId, "QUEUED", "CLASSIFYING");
    await expect(s.transition(r.executionId, "QUEUED", "CLASSIFYING")).rejects.toThrow(/no longer in state/);
  });
});
