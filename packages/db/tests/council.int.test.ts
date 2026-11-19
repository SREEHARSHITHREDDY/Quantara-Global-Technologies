import { describe, expect, it } from "vitest";
import { AGENT_CODES, FREE_RATE, MockProvider, runExecution, type AgentCode, type MockScenario } from "@quantara/council";
import { createExecutionStore, failExecution, failStaleExecutions, findCustomerOrgByEmail, getCouncilOrgAccess, getExecutionResult, getExecutionView, listExecutionEvents, listExecutionsForUser, recordReportAccess, createApprovalRequests, getCouncilDashboard, listApprovals, decideApproval, requestCancel, reserveExecution, setCouncilPlan } from "../src/council";
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

describe("start, read and cleanup helpers", () => {
  it("reserving without a conversation creates one, and stores participants, provider and template", async () => {
    const t = await tenant();
    const r = await reserveExecution(db, { organizationId: t.org.id, userId: t.user.id, mode: "MULTI_EXECUTIVE", prompt: "Plan a market entry", participants: ["CEO", "CFO"], providerKey: "mock", templateId: "market-entry", estimate: { tokens: 1000, costUsd: 0 }, maxConcurrent: 3 });
    if (!r.ok) throw new Error(r.reason);
    const v = await getExecutionView(db, r.executionId, t.org.id);
    expect(v).toMatchObject({ participants: ["CEO", "CFO"], providerKey: "mock", templateId: "market-entry", status: "QUEUED", userId: t.user.id });
    expect(await db.conversation.count({ where: { organizationId: t.org.id } })).toBe(2); // the helper tenant's plus this one
  });
  it("views, results and events are scoped to the organization", async () => {
    const a = await tenant(); const b = await tenant();
    const { id } = await runIt(a, "success");
    expect((await getExecutionView(db, id, a.org.id))?.reportReady).toBe(true);
    expect(await getExecutionView(db, id, b.org.id)).toBeNull();
    expect(await getExecutionResult(db, id, a.org.id)).not.toBeNull();
    expect(await getExecutionResult(db, id, b.org.id)).toBeNull();
    expect((await listExecutionEvents(db, { executionId: id, organizationId: a.org.id, afterSeq: 0 })).length).toBeGreaterThan(10);
    expect(await listExecutionEvents(db, { executionId: id, organizationId: b.org.id, afterSeq: 0 })).toEqual([]);
  });
  it("events can be read after a sequence number, in order, with a limit", async () => {
    const t = await tenant(); const { id } = await runIt(t, "success");
    const all = await listExecutionEvents(db, { executionId: id, organizationId: t.org.id, afterSeq: 0, limit: 500 });
    const tail = await listExecutionEvents(db, { executionId: id, organizationId: t.org.id, afterSeq: 5, limit: 3 });
    expect(tail.map((e) => e.seq)).toEqual([6, 7, 8]);
    expect(all.map((e) => e.seq)).toEqual(all.map((_, i) => i + 1));
  });
  it("failExecution ends an unfinished execution and releases its reservation, but never changes a finished one", async () => {
    const t = await tenant({ tokens: 10_000 });
    const r = await reserve(t, 9000, 5); if (!r.ok) throw new Error();
    expect(await reserve(t, 9000, 5)).toEqual({ ok: false, reason: "budget_exceeded" });
    expect(await failExecution(db, { executionId: r.executionId, organizationId: t.org.id, error: "enqueue_failed" })).toBe(true);
    expect((await reserve(t, 9000, 5)).ok).toBe(true);
    const done = await runIt(await tenant(), "success");
    expect(await failExecution(db, { executionId: done.id, organizationId: (await db.execution.findUniqueOrThrow({ where: { id: done.id } })).organizationId, error: "x" })).toBe(false);
  });
  it("stale cleanup times out past-deadline executions and fails abandoned ones, leaving fresh ones alone", async () => {
    const t = await tenant();
    const mk = async () => { const r = await reserve(t, 100, 99); if (!r.ok) throw new Error(); return r.executionId; };
    const fresh = await mk(), late = await mk(), old = await mk();
    await db.execution.update({ where: { id: late }, data: { status: "ASSESSING", deadlineAt: new Date(Date.now() - 20 * 60_000) } });
    await db.execution.update({ where: { id: old }, data: { createdAt: new Date(Date.now() - 3 * 3_600_000) } });
    const r = await failStaleExecutions(db);
    expect(r.timedOut).toBeGreaterThanOrEqual(1); expect(r.failed).toBeGreaterThanOrEqual(1);
    const st = async (id: string) => (await db.execution.findUniqueOrThrow({ where: { id } })).status;
    expect(await st(fresh)).toBe("QUEUED"); expect(await st(late)).toBe("TIMED_OUT"); expect(await st(old)).toBe("FAILED");
  });
});

describe("council plan management", () => {
  it("sets a trial with an end date, audits it, and clients default to disabled", async () => {
    const t = await tenant();
    expect((await getCouncilOrgAccess(db, t.org.id))?.plan).toBe("DISABLED");
    await expect(setCouncilPlan(db, { organizationId: t.org.id, plan: "TRIAL" })).rejects.toThrow(/days/);
    const now = new Date("2026-11-18T00:00:00Z");
    const r = await setCouncilPlan(db, { organizationId: t.org.id, plan: "TRIAL", trialDays: 14, now });
    expect(r.trialEndsAt?.toISOString()).toBe("2026-12-02T00:00:00.000Z");
    expect(await getCouncilOrgAccess(db, t.org.id)).toMatchObject({ plan: "TRIAL" });
    const log = await db.auditLog.findFirstOrThrow({ where: { organizationId: t.org.id, action: "council.plan.set" } });
    expect(log.metadata).toMatchObject({ plan: "TRIAL" });
    await setCouncilPlan(db, { organizationId: t.org.id, plan: "STANDARD", maxConcurrent: 3 });
    expect(await getCouncilOrgAccess(db, t.org.id)).toMatchObject({ plan: "STANDARD", trialEndsAt: null, maxConcurrentOverride: 3 });
  });
  it("finds a customer workspace by email, not a staff one", async () => {
    const t = await tenant();
    const u = await db.user.findUniqueOrThrow({ where: { id: t.user.id } });
    expect((await findCustomerOrgByEmail(db, u.email.toUpperCase()))?.organizationId).toBe(t.org.id);
    expect(await findCustomerOrgByEmail(db, "nobody@example.test")).toBeNull();
  });
});

describe("listExecutionsForUser", () => {
  it("shows a member only their own consultations, newest first, and never another organization's", async () => {
    const t = await tenant();
    const other = await makeUser(); await makeMember(t.org.id, other.id);
    const mine1 = await reserve(t); const mine2 = await reserve(t);
    const oc = await db.conversation.create({ data: { organizationId: t.org.id, userId: other.id, title: "o", mode: "FULL_COUNCIL" } });
    await db.execution.create({ data: { organizationId: t.org.id, userId: other.id, conversationId: oc.id, mode: "FULL_COUNCIL", prompt: "theirs", status: "QUEUED", tokenBudget: 10, costBudgetUsd: "0.01", deadlineAt: new Date(Date.now() + 60_000) } });
    const outsider = await tenant(); await reserve(outsider);
    const list = await listExecutionsForUser(db, { organizationId: t.org.id, userId: t.user.id, orgWide: false });
    expect(list).toHaveLength(2);
    expect(list.every((x) => x.userId === t.user.id)).toBe(true);
    expect(list[0]!.id).toBe(mine2.ok ? mine2.executionId : "");
    expect(list[1]!.id).toBe(mine1.ok ? mine1.executionId : "");
  });
  it("org-wide listing includes colleagues but stays inside the organization, and the limit is capped", async () => {
    const t = await tenant();
    const other = await makeUser(); await makeMember(t.org.id, other.id);
    await reserve(t);
    const oc = await db.conversation.create({ data: { organizationId: t.org.id, userId: other.id, title: "o", mode: "FULL_COUNCIL" } });
    await db.execution.create({ data: { organizationId: t.org.id, userId: other.id, conversationId: oc.id, mode: "FULL_COUNCIL", prompt: "x".repeat(400), status: "QUEUED", tokenBudget: 10, costBudgetUsd: "0.01", deadlineAt: new Date(Date.now() + 60_000) } });
    const all = await listExecutionsForUser(db, { organizationId: t.org.id, userId: t.user.id, orgWide: true });
    expect(all).toHaveLength(2);
    expect(all.find((x) => x.userId === other.id)!.prompt.length).toBeLessThanOrEqual(161);
    expect(await listExecutionsForUser(db, { organizationId: t.org.id, userId: t.user.id, orgWide: true, limit: 1 })).toHaveLength(1);
  });
});

describe("report access audit", () => {
  it("records who exported a report and whose it was", async () => {
    const t = await tenant();
    const r = await reserve(t); if (!r.ok) throw new Error("reserve");
    await recordReportAccess(db, { organizationId: t.org.id, actorId: t.user.id, executionId: r.executionId, action: "council.report.exported", format: "md", ownerId: t.user.id });
    const row = await db.auditLog.findFirstOrThrow({ where: { resourceId: r.executionId, action: "council.report.exported" } });
    expect(row.organizationId).toBe(t.org.id);
    expect(row.actorId).toBe(t.user.id);
    expect(row.metadata).toMatchObject({ format: "md", ownerId: t.user.id });
  });
});

describe("approvals", () => {
  const asks = [{ agent: "CFO", action: "Transfer AED 2M to the new entity", reason: "Funds the setup" }, { agent: "CLO", action: "Sign the lease", reason: "Binding" }];
  async function withApprovals() {
    const t = await tenant(); const r = await reserve(t); if (!r.ok) throw new Error("reserve");
    await createApprovalRequests(db, { organizationId: t.org.id, executionId: r.executionId, requesterId: t.user.id, approvals: asks });
    return { t, executionId: r.executionId };
  }
  it("creates requests with a category and expiry, and never duplicates them", async () => {
    const { t, executionId } = await withApprovals();
    expect(await createApprovalRequests(db, { organizationId: t.org.id, executionId, requesterId: t.user.id, approvals: asks })).toBe(0);
    const list = await listApprovals(db, { organizationId: t.org.id, userId: t.user.id, scope: "own" });
    expect(list).toHaveLength(2);
    expect(list.map((x) => x.category).sort()).toEqual(["CONTRACT_SIGNING", "FINANCIAL_TRANSFER"]);
    expect(list.every((x) => x.status === "PENDING" && x.expiresAt && x.expiresAt > new Date())).toBe(true);
  });
  it("approve and reject record who decided, when, and why, and write the audit log", async () => {
    const { t } = await withApprovals();
    const boss = await makeUser(); await makeMember(t.org.id, boss.id);
    const [a, b] = await listApprovals(db, { organizationId: t.org.id, userId: t.user.id, scope: "org" });
    const ok = await decideApproval(db, { id: a!.id, organizationId: t.org.id, deciderId: boss.id, decision: "APPROVED", note: "Budget confirmed" });
    expect(ok.ok && ok.approval.status).toBe("APPROVED");
    const rej = await decideApproval(db, { id: b!.id, organizationId: t.org.id, deciderId: boss.id, decision: "REJECTED", note: "Not now" });
    expect(rej.ok).toBe(true);
    const row = await db.approvalRequest.findUniqueOrThrow({ where: { id: a!.id } });
    expect(row).toMatchObject({ status: "APPROVED", decidedById: boss.id, decisionNote: "Budget confirmed" });
    expect(row.decidedAt).toBeInstanceOf(Date);
    const audit = await db.auditLog.findFirstOrThrow({ where: { resourceId: a!.id, action: "council.approval.approved" } });
    expect(audit.actorId).toBe(boss.id);
  });
  it("a request can be decided once; a concurrent second decision loses", async () => {
    const { t } = await withApprovals();
    const x = await makeUser(); const y = await makeUser();
    const [a] = await listApprovals(db, { organizationId: t.org.id, userId: t.user.id, scope: "org" });
    const results = await Promise.all([
      decideApproval(db, { id: a!.id, organizationId: t.org.id, deciderId: x.id, decision: "APPROVED" }),
      decideApproval(db, { id: a!.id, organizationId: t.org.id, deciderId: y.id, decision: "REJECTED" }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ reason: "already_decided" });
    expect(await db.auditLog.count({ where: { resourceId: a!.id, action: { startsWith: "council.approval." } } })).toBe(1);
  });
  it("another organization cannot decide or even find the request", async () => {
    const { t } = await withApprovals();
    const other = await tenant();
    const [a] = await listApprovals(db, { organizationId: t.org.id, userId: t.user.id, scope: "org" });
    expect(await decideApproval(db, { id: a!.id, organizationId: other.org.id, deciderId: other.user.id, decision: "APPROVED" })).toEqual({ ok: false, reason: "not_found" });
    expect((await db.approvalRequest.findUniqueOrThrow({ where: { id: a!.id } })).status).toBe("PENDING");
    expect(await listApprovals(db, { organizationId: other.org.id, userId: other.user.id, scope: "org" })).toHaveLength(0);
  });
  it("expired requests cannot be approved and are reported as expired", async () => {
    const { t } = await withApprovals();
    const [a] = await listApprovals(db, { organizationId: t.org.id, userId: t.user.id, scope: "org" });
    const future = new Date(Date.now() + 31 * 86_400_000);
    expect(await decideApproval(db, { id: a!.id, organizationId: t.org.id, deciderId: t.user.id, decision: "APPROVED", now: future })).toEqual({ ok: false, reason: "expired" });
    expect((await db.approvalRequest.findUniqueOrThrow({ where: { id: a!.id } })).status).toBe("EXPIRED");
  });
  it("a finished consultation creates its approval requests automatically", async () => {
    const t = await tenant(); const r = await reserve(t); if (!r.ok) throw new Error("reserve");
    const store = createExecutionStore(db, t.org.id);
    await store.saveResult(r.executionId, { simulated: true, label: "SIMULATED ANALYSIS", consensus: true, headline: "h", overallConfidence: 0.5, agents: [], disagreements: [], missingInformation: [], assumptions: [], risks: [], approvalsRequired: [{ agent: "CEO", action: "Announce to partners", reason: "External" }], claims: [], failedAgents: [], skippedAgents: [], caveats: [] });
    await store.saveResult(r.executionId, { simulated: true, label: "SIMULATED ANALYSIS", consensus: true, headline: "h", overallConfidence: 0.5, agents: [], disagreements: [], missingInformation: [], assumptions: [], risks: [], approvalsRequired: [{ agent: "CEO", action: "Announce to partners", reason: "External" }], claims: [], failedAgents: [], skippedAgents: [], caveats: [] });
    const list = await listApprovals(db, { organizationId: t.org.id, userId: t.user.id, scope: "own" });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ category: "EXTERNAL_ACTION", agent: "CEO" });
  });
});

describe("council dashboard", () => {
  it("counts only the caller's own work in own scope, and the whole organization in org scope", async () => {
    const t = await tenant();
    const other = await makeUser(); await makeMember(t.org.id, other.id);
    const mine = await reserve(t); if (!mine.ok) throw new Error("reserve");
    const oc = await db.conversation.create({ data: { organizationId: t.org.id, userId: other.id, title: "o", mode: "FULL_COUNCIL" } });
    await db.execution.create({ data: { organizationId: t.org.id, userId: other.id, conversationId: oc.id, mode: "FULL_COUNCIL", prompt: "theirs", status: "SUCCEEDED", tokenBudget: 10, costBudgetUsd: "0.01", tokensUsed: 500, costUsd: "0.25", deadlineAt: new Date(Date.now() + 60_000) } });
    await createApprovalRequests(db, { organizationId: t.org.id, executionId: mine.executionId, requesterId: t.user.id, approvals: [{ agent: "CEO", action: "Announce", reason: "r" }] });
    const own = await getCouncilDashboard(db, { organizationId: t.org.id, userId: t.user.id, scope: "own" });
    const org = await getCouncilDashboard(db, { organizationId: t.org.id, userId: t.user.id, scope: "org" });
    expect(own).toMatchObject({ totalSessions: 1, activeRuns: 1, pendingApprovals: 1 });
    expect(own.usage.tokenBudget).toBeNull();
    expect(org).toMatchObject({ totalSessions: 2, activeRuns: 1, pendingApprovals: 1 });
    expect(org.usage.tokens).toBe(500);
    expect(org.usage.costUsd).toBeCloseTo(0.25);
    expect(org.usage.tokenBudget).toBeGreaterThan(0);
    expect(org.recentActivity.length).toBeGreaterThanOrEqual(3);
    expect(org.recentActivity.some((x) => x.kind === "approval")).toBe(true);
  });
  it("never includes another organization's numbers", async () => {
    const a = await tenant(); const b = await tenant();
    await reserve(b);
    const d = await getCouncilDashboard(db, { organizationId: a.org.id, userId: a.user.id, scope: "org" });
    expect(d).toMatchObject({ totalSessions: 0, activeRuns: 0, completedReports: 0, pendingApprovals: 0, recentActivity: [] });
  });
});
