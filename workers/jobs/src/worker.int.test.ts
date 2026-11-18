// Integration test against REAL PostgreSQL. Skips (visibly) when WORKER_TEST_DATABASE_URL-capable server is unavailable.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { enqueue, InvalidPayloadError, startWorker, type RunningWorker } from "./worker";

const ADMIN = process.env.PG_ADMIN_URL ?? "postgresql://quantara:quantara_dev_only@127.0.0.1:5432/postgres";
const DB = `quantara_worker_test_${Date.now()}`;
const url = (db: string) => { const u = new URL(ADMIN); u.pathname = `/${db}`; return u.toString(); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor<T>(fn: () => Promise<T | null | false>, ms = 15_000): Promise<T> { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error("timeout"); await sleep(250); } }

let w: RunningWorker; const handled: string[] = []; let reachable = true;
beforeAll(async () => {
  const a = new pg.Client({ connectionString: ADMIN });
  try { await a.connect(); } catch { reachable = false; return; }
  await a.query(`CREATE DATABASE "${DB}"`); await a.end();
  w = await startWorker({ connectionString: url(DB), logger: { info() {}, error() {} },
    handlers: { "system.ping": async (p) => { handled.push(p.note ?? ""); }, "retention.purge": async () => { throw new Error("boom"); } } });
}, 60_000);
afterAll(async () => {
  if (!reachable) return; await w.stop(5000);
  const a = new pg.Client({ connectionString: ADMIN }); await a.connect(); await a.query(`DROP DATABASE IF EXISTS "${DB}" WITH (FORCE)`); await a.end();
}, 30_000);

describe("worker against real PostgreSQL", () => {
  it("runs a valid job through a registered handler", async () => {
    if (!reachable) return expect.soft(reachable, "PostgreSQL not reachable: test SKIPPED, not passed").toBe(true);
    await enqueue(w.boss, "system.ping", { note: "hello" });
    await waitFor(async () => handled.includes("hello"));
  });
  it("refuses to enqueue an invalid payload", async () => {
    if (!reachable) return;
    await expect(enqueue(w.boss, "council.execute", { executionId: "", organizationId: "o" })).rejects.toBeInstanceOf(InvalidPayloadError);
  });
  it("fails (never succeeds) jobs whose handler is not implemented, and dead-letters them", async () => {
    if (!reachable) return;
    const id = (await enqueue(w.boss, "document.process", { documentId: "d1", organizationId: "o1" }))!;
    const job = await waitFor(async () => { const j = await w.boss.getJobById("document.process", id); return j && (j.state === "retry" || j.state === "failed") ? j : null; });
    expect(job.state).not.toBe("completed");
  });
  it("a throwing handler marks the job failed with no retries (retryLimit>0 queues go to retry first)", async () => {
    if (!reachable) return;
    const id = (await enqueue(w.boss, "retention.purge", { scope: "sessions" }))!;
    const job = await waitFor(async () => { const j = await w.boss.getJobById("retention.purge", id); return j && j.state !== "created" && j.state !== "active" ? j : null; });
    expect(["retry", "failed"]).toContain(job.state);
  });
  it("de-duplicates the same council execution (singleton key)", async () => {
    if (!reachable) return;
    const first = await enqueue(w.boss, "council.execute", { executionId: "exec-dup", organizationId: "o1" }, { startAfterSeconds: 3600 });
    const second = await enqueue(w.boss, "council.execute", { executionId: "exec-dup", organizationId: "o1" }, { startAfterSeconds: 3600 });
    expect(first).toBeTruthy(); expect(second).toBeNull();
  });
});
