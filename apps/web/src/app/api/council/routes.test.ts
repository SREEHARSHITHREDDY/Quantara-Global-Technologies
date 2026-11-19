import { beforeEach, describe, expect, it, vi } from "vitest";

// Boundary tests for every council API route: signed-out callers get 401, and cross-site POSTs are refused before anything else runs.
const state = vi.hoisted(() => ({ caller: null as unknown }));
vi.mock("@/lib/council-caller", () => ({ getCouncilCaller: async () => state.caller }));
vi.mock("@/server/council-runtime", () => ({ siteOrigin: () => "https://app.example.com", councilStartDeps: () => ({}), councilProviderChoices: async () => [] }));
vi.mock("@quantara/db", () => new Proxy({}, { get: (_t, k) => (k === "then" || typeof k === "symbol" ? undefined : k === "getPrisma" ? () => ({}) : async () => { throw new Error(`database touched: ${String(k)}`); }) }));
vi.mock("@quantara/auth", () => ({ getMembershipContext: async () => null }));

import { POST as startPost } from "./executions/route";
import { GET as readGet } from "./executions/[id]/route";
import { POST as cancelPost } from "./executions/[id]/cancel/route";
import { GET as eventsGet } from "./executions/[id]/events/route";
import { GET as exportGet } from "./executions/[id]/export/route";
import { GET as approvalsGet } from "./approvals/route";
import { POST as decidePost } from "./approvals/[id]/route";

const params = { params: Promise.resolve({ id: "exec-12345678" }) };
const url = "https://app.example.com/api/council/x";
const post = (origin: string | null, body = "{}") => new Request(url, { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body });
const get = () => new Request(url);

beforeEach(() => { state.caller = null; });

describe("signed-out callers get 401 from every route", () => {
  it.each([
    ["GET read", () => readGet(get(), params)],
    ["GET events", () => eventsGet(get(), params)],
    ["GET export", () => exportGet(get(), params)],
    ["GET approvals", () => approvalsGet()],
    ["POST start", () => startPost(post("https://app.example.com"))],
    ["POST cancel", () => cancelPost(post("https://app.example.com"), params)],
    ["POST decide", () => decidePost(post("https://app.example.com", '{"decision":"APPROVED"}'), params)],
  ])("%s", async (_n, call) => { expect((await call()).status).toBe(401); });
});

describe("cross-site and origin-less POSTs are refused before authentication", () => {
  it.each([
    ["start", (o: string | null) => startPost(post(o))],
    ["cancel", (o: string | null) => cancelPost(post(o), params)],
    ["decide", (o: string | null) => decidePost(post(o), params)],
  ])("%s", async (_n, call) => {
    expect((await call("https://evil.example.net")).status).toBe(403);
    expect((await call(null)).status).toBe(403);
  });
});

describe("request shape", () => {
  it("export refuses an unknown format before touching the database", async () => {
    state.caller = { userId: "u1", organizationId: "o1", ctx: { role: "council_user", orgType: "CLIENT", orgStatus: "ACTIVE", userBanned: false } };
    const r = await exportGet(new Request(`${url}?format=exe`), params);
    expect(r.status).toBe(400);
  });
  it("start refuses a body that is not JSON", async () => {
    state.caller = { userId: "u1", organizationId: "o1", ctx: { role: "council_user", orgType: "CLIENT", orgStatus: "ACTIVE", userBanned: false } };
    const r = await startPost(post("https://app.example.com", "not json"));
    expect(r.status).toBe(400);
  });
  it("decide refuses an oversized body", async () => {
    state.caller = { userId: "u1", organizationId: "o1", ctx: { role: "admin", orgType: "CLIENT", orgStatus: "ACTIVE", userBanned: false } };
    const r = await decidePost(post("https://app.example.com", "x".repeat(9000)), params);
    expect(r.status).toBe(413);
  });
});
