import { PgBoss, type Job } from "pg-boss";
import { QUEUES, QUEUE_NAMES, deadLetterName, type Payload, type QueueName } from "./queues";

export class NotImplementedError extends Error { constructor(queue: string) { super(`No handler implemented for queue "${queue}"`); this.name = "NotImplementedError"; } }
export class InvalidPayloadError extends Error { constructor(queue: string, detail: string) { super(`Invalid payload for "${queue}": ${detail}`); this.name = "InvalidPayloadError"; } }

export interface JobContext { jobId: string; attempt: number; signal: AbortSignal }
export type Handler<Q extends QueueName> = (payload: Payload<Q>, ctx: JobContext) => Promise<void>;
export type Handlers = { [Q in QueueName]?: Handler<Q> };
export interface Logger { info(m: string, x?: object): void; error(m: string, x?: object): void }
const consoleLogger: Logger = { info: (m, x) => console.log(JSON.stringify({ level: "info", msg: m, ...x })), error: (m, x) => console.error(JSON.stringify({ level: "error", msg: m, ...x })) };

export interface WorkerOptions { connectionString: string; handlers: Handlers; logger?: Logger; schema?: string; concurrency?: Partial<Record<QueueName, number>> }
export interface RunningWorker { boss: PgBoss; stop(timeoutMs?: number): Promise<void> }

/** Default handlers for queues that are not built yet: they FAIL jobs loudly; they never report success. */
export const notImplemented = (q: QueueName) => async () => { throw new NotImplementedError(q); };

export async function startWorker(o: WorkerOptions): Promise<RunningWorker> {
  const log = o.logger ?? consoleLogger;
  const boss = new PgBoss({ connectionString: o.connectionString, schema: o.schema ?? "pgboss", application_name: "quantara-worker" });
  boss.on("error", (e) => log.error("pg-boss error", { error: String(e) }));
  await boss.start();

  for (const q of QUEUE_NAMES) {
    await boss.createQueue(deadLetterName(q), { retentionSeconds: 60 * 60 * 24 * 14 });
    const policy = (QUEUES[q] as { policy?: "exclusive" }).policy;
    await boss.createQueue(q, { ...QUEUES[q].options, ...(policy ? { policy } : {}), deadLetter: deadLetterName(q) });
    const handler = (o.handlers[q] ?? notImplemented(q)) as (p: unknown, c: JobContext) => Promise<void>;
    await boss.work<object>(q, { batchSize: 1, localConcurrency: o.concurrency?.[q] ?? 2, pollingIntervalSeconds: 2 }, async ([job]: Job<object>[]) => {
      if (!job) return;
      const parsed = QUEUES[q].payload.safeParse(job.data);
      if (!parsed.success) throw new InvalidPayloadError(q, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      const started = Date.now();
      try {
        await handler(parsed.data, { jobId: job.id, attempt: job.retryCount + 1, signal: job.signal });
        log.info("job completed", { queue: q, jobId: job.id, ms: Date.now() - started });
      } catch (e) {
        log.error("job failed", { queue: q, jobId: job.id, attempt: job.retryCount + 1, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) });
        throw e; // let pg-boss apply the retry policy / dead-letter
      }
    });
  }
  log.info("worker started", { queues: QUEUE_NAMES });
  return { boss, stop: async (t = 30_000) => { await boss.stop({ graceful: true, timeout: t }); } };
}

/** Validate then enqueue. Returns null when a duplicate (same singleton key) is already queued. */
export async function enqueue<Q extends QueueName>(boss: PgBoss, queue: Q, payload: Payload<Q>, opts: { startAfterSeconds?: number } = {}): Promise<string | null> {
  const def = QUEUES[queue] as (typeof QUEUES)[QueueName] & { singletonBy?: string };
  const parsed = def.payload.safeParse(payload);
  if (!parsed.success) throw new InvalidPayloadError(queue, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const singletonKey = def.singletonBy ? String((parsed.data as Record<string, unknown>)[def.singletonBy]) : undefined;
  return boss.send(queue, parsed.data, { ...(singletonKey ? { singletonKey } : {}), ...(opts.startAfterSeconds ? { startAfter: opts.startAfterSeconds } : {}) });
}
