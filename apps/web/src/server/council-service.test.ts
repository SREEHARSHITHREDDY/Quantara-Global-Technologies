import { describe, expect, it } from "vitest";
import { FREE_RATE, type ProviderId } from "@quantara/council";
import type { ExecutionView, ReserveInput } from "@quantara/db";
import type { MembershipContext } from "@quantara/rbac";
import { cancelConsultation, readConsultation, startConsultation, type Caller, type StartDeps } from "./council-service";

const NOW = new Date("2026-11-18T10:00:00Z");
const ctx = (role = "council_user"): MembershipContext => ({ role, orgType: "CLIENT", orgStatus: "ACTIVE", userBanned: false });
const caller = (role = "council_user"): Caller => ({ userId: "u1", organizationId: "o1", ctx: ctx(role) });
const good = { prompt: "Should we open an office in Singapore next year?", mode: "FULL_COUNCIL" };

function deps(over: Partial<StartDeps> = {}) {
  const calls = { reserve: [] as ReserveInput[], enqueue: [] as string[], fail: [] as string[] };
  const d: StartDeps = {
    getAccess: async () => ({ plan: "STANDARD", trialEndsAt: null, maxConcurrentOverride: null }),
    platformProviders: async () => ["mock"] as ProviderId[],
    rateFor: () => FREE_RATE,
    reserve: async (i) => { calls.reserve.push(i); return { ok: true, executionId: "exec-1" }; },
    enqueue: async (id) => { calls.enqueue.push(id); },
    fail: async (_i, _o, e) => { calls.fail.push(e); },
    hitRateLimit: async () => ({ allowed: true }),
    now: () => NOW,
    ...over,
  };
  return { d, calls };
}
const status = async (raw: unknown, over: Partial<StartDeps> = {}, c = caller()) => { const { d, calls } = deps(over); return { r: await startConsultation(c, raw, d), calls }; };

describe("startConsultation", () => {
  it("reserves, then queues, and returns the execution id", async () => {
    const { r, calls } = await status(good);
    expect(r).toEqual({ ok: true, executionId: "exec-1" });
    expect(calls.enqueue).toEqual(["exec-1"]);
    expect(calls.reserve[0]).toMatchObject({ organizationId: "o1", userId: "u1", mode: "FULL_COUNCIL", providerKey: "mock" });
    expect(calls.reserve[0]!.participants).toHaveLength(10);
    expect(calls.reserve[0]!.deadlineAt?.toISOString()).toBe("2026-11-18T10:15:00.000Z"); // standard plan: 900 s
    expect(calls.reserve[0]!.maxConcurrent).toBe(2);
  });
  it("is forbidden without council:use and never touches the database", async () => {
    const { r, calls } = await status(good, {}, caller("bd_manager"));
    expect(r).toMatchObject({ ok: false, status: 403, code: "forbidden" });
    expect(calls.reserve).toHaveLength(0);
  });
  it("is off by default, and says so", async () => {
    const { r, calls } = await status(good, { getAccess: async () => ({ plan: "DISABLED", trialEndsAt: null, maxConcurrentOverride: null }) });
    expect(r).toMatchObject({ ok: false, status: 403, code: "council_disabled" });
    expect(calls.reserve).toHaveLength(0);
  });
  it("an expired or undated trial is refused; an active trial works but excludes the full council", async () => {
    const expired = await status(good, { getAccess: async () => ({ plan: "TRIAL", trialEndsAt: new Date("2026-11-01T00:00:00Z"), maxConcurrentOverride: null }) });
    expect(expired.r).toMatchObject({ ok: false, code: "trial_expired" });
    const active = { getAccess: async () => ({ plan: "TRIAL" as const, trialEndsAt: new Date("2026-12-01T00:00:00Z"), maxConcurrentOverride: null }) };
    expect((await status(good, active)).r).toMatchObject({ ok: false, code: "mode_not_in_plan" });
    expect((await status({ ...good, mode: "CEO_RECOMMENDATION" }, active)).r.ok).toBe(true);
  });
  it("an organization with no row is refused", async () => {
    expect((await status(good, { getAccess: async () => null })).r).toMatchObject({ ok: false, status: 403 });
  });
  it("validates the request and reports which field is wrong", async () => {
    const short = await status({ ...good, prompt: "hi" });
    expect(short.r).toMatchObject({ ok: false, status: 400, code: "invalid_request" });
    expect((short.r as { fieldErrors?: Record<string, unknown> }).fieldErrors?.prompt).toBeDefined();
    expect((await status({ ...good, mode: "WHATEVER" })).r).toMatchObject({ status: 400 });
    expect((await status({ ...good, prompt: "x".repeat(8001) })).r).toMatchObject({ status: 400 });
    expect((await status("not an object")).r).toMatchObject({ status: 400 });
    expect((await status({ ...good, provider: "skynet" })).r).toMatchObject({ status: 400 });
  });
  it("applies the selection rules", async () => {
    expect((await status({ ...good, mode: "INDIVIDUAL", participants: ["CFO", "CTO"] })).r).toMatchObject({ status: 400, code: "individual_needs_one_agent" });
    expect((await status({ ...good, mode: "MULTI_EXECUTIVE", templateId: "nope" })).r).toMatchObject({ status: 400, code: "unknown_template" });
    const t = await status({ ...good, mode: "MULTI_EXECUTIVE", templateId: "gcc-establishment" });
    expect(t.r.ok).toBe(true);
    expect(t.calls.reserve[0]).toMatchObject({ participants: ["CEO", "CFO", "CTO", "COO", "CHRO", "CLO"], templateId: "gcc-establishment" });
  });
  it("is unavailable when no provider is enabled, or the chosen one is not allowed", async () => {
    expect((await status(good, { platformProviders: async () => [] })).r).toMatchObject({ status: 503, code: "no_provider" });
    expect((await status({ ...good, provider: "openai" })).r).toMatchObject({ status: 400, code: "provider_not_allowed" });
    expect((await status(good, { rateFor: () => null })).r).toMatchObject({ status: 503, code: "provider_not_configured" });
  });
  it("turns concurrency and budget refusals into 429 with plain messages", async () => {
    const c = await status(good, { reserve: async () => ({ ok: false, reason: "concurrency_limit" }) });
    expect(c.r).toMatchObject({ status: 429, code: "concurrency_limit" });
    const b = await status(good, { reserve: async () => ({ ok: false, reason: "budget_exceeded" }) });
    expect(b.r).toMatchObject({ status: 429, code: "budget_exceeded" });
    expect(c.calls.enqueue).toHaveLength(0);
  });
  it("rate limits per user", async () => {
    const { r, calls } = await status(good, { hitRateLimit: async () => ({ allowed: false }) });
    expect(r).toMatchObject({ status: 429, code: "rate_limited" });
    expect(calls.reserve).toHaveLength(0);
  });
  it("if the queue is down, the reservation is released and the user is told to retry", async () => {
    const { r, calls } = await status(good, { enqueue: async () => { throw new Error("pgboss schema missing: secret detail"); } });
    expect(r).toMatchObject({ ok: false, status: 503, code: "queue_unavailable" });
    expect(JSON.stringify(r)).not.toContain("secret detail");
    expect(calls.fail).toEqual(["enqueue_failed"]);
  });
  it("uses the caller's own organization, never one from the request", async () => {
    const { calls } = await status({ ...good, organizationId: "someone-else", userId: "someone-else" });
    expect(calls.reserve[0]).toMatchObject({ organizationId: "o1", userId: "u1" });
  });
});

describe("cancelConsultation", () => {
  it("passes the caller's own ids and reports not found", async () => {
    const seen: unknown[] = [];
    const ok = await cancelConsultation(caller(), "e1", { requestCancel: async (a) => { seen.push(a); return { found: true }; } });
    expect(ok).toEqual({ ok: true }); expect(seen[0]).toEqual({ executionId: "e1", organizationId: "o1", userId: "u1" });
    expect(await cancelConsultation(caller(), "e1", { requestCancel: async () => ({ found: false }) })).toMatchObject({ status: 404 });
    expect(await cancelConsultation(caller("bd_manager"), "e1", { requestCancel: async () => ({ found: true }) })).toMatchObject({ status: 403 });
  });
});

describe("readConsultation", () => {
  const view = (over: Partial<ExecutionView> = {}): ExecutionView => ({
    id: "e1", organizationId: "o1", userId: "u1", status: "SUCCEEDED", mode: "FULL_COUNCIL", prompt: "secret prompt", participants: ["CEO"], providerKey: "mock", templateId: null,
    error: null, tokensUsed: 5, costUsd: 0, reportReady: true, deadlineAt: null, createdAt: NOW, startedAt: NOW, finishedAt: NOW, ...over,
  });
  const reader = (v: ExecutionView | null) => ({ getView: async () => v, getResult: async () => ({ label: "SIMULATED ANALYSIS" }) });
  it("returns the owner's consultation with its result, and never leaks internals", async () => {
    const r = await readConsultation(caller(), "e1", reader(view()));
    expect(r.ok && r.consultation.result).toEqual({ label: "SIMULATED ANALYSIS" });
    expect(JSON.stringify(r)).not.toContain("secret prompt");
    expect(JSON.stringify(r)).not.toContain("providerKey");
  });
  it("hides another member's consultation unless the caller has org-wide history access; missing and forbidden look the same", async () => {
    const other = view({ userId: "u2" });
    expect(await readConsultation(caller("council_user"), "e1", reader(other))).toMatchObject({ ok: false, status: 404 });
    expect(await readConsultation(caller("council_user"), "e1", reader(null))).toMatchObject({ ok: false, status: 404 });
    expect((await readConsultation(caller("admin"), "e1", reader(other))).ok).toBe(true);
  });
  it("does not fetch a result that is not ready", async () => {
    const r = await readConsultation(caller(), "e1", reader(view({ reportReady: false, status: "ASSESSING" })));
    expect(r.ok && r.consultation.result).toBeNull();
  });
  it("refuses a record from a different organization even if the lookup returned it", async () => {
    expect(await readConsultation(caller(), "e1", reader(view({ organizationId: "o2" })))).toMatchObject({ ok: false, status: 404 });
  });
});
