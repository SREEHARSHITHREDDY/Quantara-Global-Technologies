// Worker entrypoint. Deploy as its own long-running process (NOT a serverless function).
import "./env";
import { FREE_RATE, MOCK_SCENARIOS, MockProvider, type MockScenario } from "@quantara/council";
import { createExecutionStore, createPrisma, failExecution, failStaleExecutions } from "@quantara/db";
import { createCouncilHandler } from "./handlers/council-execute";
import { startWorker } from "./worker";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is required"); process.exit(1); }

// Real handlers are registered here as each feature lands. Queues without a handler FAIL jobs with NotImplementedError rather than pretending to succeed.
const db = createPrisma(url);
const mockAllowed = process.env.NODE_ENV !== "production" || process.env.COUNCIL_ENABLE_MOCK === "1";
const scenario = (MOCK_SCENARIOS as readonly string[]).includes(process.env.COUNCIL_MOCK_SCENARIO ?? "") ? (process.env.COUNCIL_MOCK_SCENARIO as MockScenario) : "success";

const worker = await startWorker({
  connectionString: url,
  handlers: {
    "system.ping": async (p) => { console.log("ping", p.note ?? ""); },
    "council.execute": createCouncilHandler({
      loadRun: async (id, org) => { const e = await db.execution.findFirst({ where: { id, organizationId: org }, select: { participants: true, providerKey: true } }); return e ? { participants: e.participants, providerKey: e.providerKey } : null; },
      makeStore: (org) => createExecutionStore(db, org),
      // Only the Mock provider exists so far. Real adapters (Anthropic, OpenAI) are added with their credentials.
      makeProvider: (key) => (key === "mock" && mockAllowed ? { provider: new MockProvider(scenario), rate: FREE_RATE } : null),
      fail: async (id, org, error) => { await failExecution(db, { executionId: id, organizationId: org, error }); },
      agentTimeoutMs: 120_000,
      log: (m, x) => console.log(JSON.stringify({ level: "info", msg: m, ...x })),
    }),
  },
});
// Safety net: end executions whose worker died or whose job expired, so their budget reservation is released.
const sweeper = setInterval(() => { failStaleExecutions(db).then((r) => { if (r.timedOut || r.failed) console.log(JSON.stringify({ level: "info", msg: "stale executions ended", ...r })); }).catch((e) => console.error("stale sweep failed", e)); }, 5 * 60_000);
sweeper.unref();
const shutdown = async (sig: string) => { console.log(`${sig}: draining`); clearInterval(sweeper); await worker.stop(); await db.$disconnect(); process.exit(0); };
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
