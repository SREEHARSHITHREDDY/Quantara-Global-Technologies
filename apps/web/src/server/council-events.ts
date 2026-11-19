export interface EventRow { seq: number; type: string; agent: string | null; payload: unknown; createdAt: Date }
export interface EventSource {
  events(afterSeq: number): Promise<EventRow[]>;
  /** Current execution status, or null if it no longer exists. */
  status(): Promise<string | null>;
}
export const TERMINAL = ["SUCCEEDED", "PARTIALLY_SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT"];

/** One Server-Sent Event. `id` is the sequence number, so a reconnecting browser resumes with Last-Event-ID. */
export const encodeEvent = (e: EventRow): string =>
  `id: ${e.seq}\nevent: ${e.type.replace(/[^\w.-]/g, "_")}\ndata: ${JSON.stringify({ seq: e.seq, type: e.type, agent: e.agent, at: e.createdAt.toISOString(), ...(e.payload && typeof e.payload === "object" ? { data: e.payload } : {}) })}\n\n`;
export const encodeComment = (text: string): string => `: ${text.replace(/\s+/g, " ")}\n\n`;

/** Parses Last-Event-ID or ?after=. Anything that is not a non-negative integer means "from the start". */
export function parseAfter(header: string | null, query: string | null): number {
  const n = Number(header ?? query ?? 0);
  return Number.isInteger(n) && n >= 0 && n < 1e9 ? n : 0;
}

export interface StreamOptions {
  afterSeq: number; signal?: AbortSignal;
  pollMs?: number; heartbeatMs?: number; maxMs?: number;
  /** After the execution ends, wait this long and read once more, because the last event is written just after the status changes. */
  endGraceMs?: number;
  /** Called every `recheckMs`; when it returns false the stream ends, so access removed mid-stream stops delivering events. */
  recheckAccess?: () => Promise<boolean>; recheckMs?: number;
  now?: () => number; sleep?: (ms: number) => Promise<void>;
}

/**
 * Yields SSE frames: past events first (replay), then new ones as they appear, a heartbeat comment when idle,
 * and a final `end` event once the execution has finished and everything has been sent.
 */
export async function* streamExecution(src: EventSource, o: StreamOptions): AsyncGenerator<string> {
  const poll = o.pollMs ?? 1000, beat = o.heartbeatMs ?? 15_000, max = o.maxMs ?? 25 * 60_000, grace = o.endGraceMs ?? 600;
  const now = o.now ?? Date.now;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const started = now();
  const recheckEvery = o.recheckMs ?? 30_000;
  let seq = o.afterSeq, lastWrite = now(), lastCheck = now();
  yield encodeComment("connected");
  for (;;) {
    if (o.signal?.aborted) return;
    if (o.recheckAccess && now() - lastCheck >= recheckEvery) {
      lastCheck = now();
      let allowed = false;
      try { allowed = await o.recheckAccess(); } catch { allowed = false; }   // fail closed
      if (!allowed) { yield `event: end\ndata: ${JSON.stringify({ reason: "access_revoked" })}\n\n`; return; }
    }
    const status = await src.status();
    if (status === null) { yield `event: end\ndata: ${JSON.stringify({ reason: "not_found" })}\n\n`; return; }
    let rows = await src.events(seq);
    if (rows.length === 0 && TERMINAL.includes(status)) {
      await sleep(grace);
      rows = await src.events(seq);
      if (rows.length === 0) { yield `event: end\ndata: ${JSON.stringify({ status })}\n\n`; return; }
    }
    for (const r of rows) { yield encodeEvent(r); seq = r.seq; lastWrite = now(); }
    if (rows.length > 0) continue;       // there may be more; read again at once
    if (now() - started > max) { yield `event: end\ndata: ${JSON.stringify({ reason: "max_duration" })}\n\n`; return; }
    if (now() - lastWrite >= beat) { yield encodeComment("keep-alive"); lastWrite = now(); }
    await sleep(poll);
  }
}
