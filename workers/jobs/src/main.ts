// Worker entrypoint. Deploy as its own long-running process (NOT a serverless function).
import "./env";
import { startWorker } from "./worker";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is required"); process.exit(1); }

// Real handlers are registered here as each feature lands (Phase 3: email.send; Phase 5: council.execute, document.process).
// Until then those queues FAIL jobs with NotImplementedError rather than pretending to succeed.
const worker = await startWorker({
  connectionString: url,
  handlers: { "system.ping": async (p) => { console.log("ping", p.note ?? ""); } },
});
const shutdown = async (sig: string) => { console.log(`${sig}: draining`); await worker.stop(); process.exit(0); };
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
