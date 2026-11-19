import { getMembershipContext } from "@quantara/auth";
import { can, canReadCouncilRecord } from "@quantara/rbac";
import { getExecutionView, getPrisma, listExecutionEvents } from "@quantara/db";
import { getCouncilCaller } from "@/lib/council-caller";
import { MAX_STREAMS_PER_USER, createStreamLimiter } from "@/lib/stream-limiter";
import { parseAfter, streamExecution } from "@/server/council-events";
import { json, unauthorized } from "../../../_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const limiter = createStreamLimiter(MAX_STREAMS_PER_USER);

/**
 * Server-Sent Events for one consultation. Access is checked when the connection opens, against the database,
 * with the same rule as reading the consultation. A reconnecting browser sends Last-Event-ID and receives only what it missed.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCouncilCaller();
  if (!caller) return unauthorized();
  const { id } = await params;
  const db = getPrisma();
  const view = await getExecutionView(db, id, caller.organizationId);
  if (!view || !canReadCouncilRecord(caller.ctx, { ownerId: view.userId, organizationId: view.organizationId }, { userId: caller.userId, organizationId: caller.organizationId }))
    return json({ error: { code: "not_found", message: "Consultation not found." } }, 404);

  const release = limiter.acquire(caller.userId);
  if (!release) return json({ error: { code: "too_many_streams", message: "Too many open progress streams. Close another tab and try again." } }, 429);
  const after = parseAfter(req.headers.get("last-event-id"), new URL(req.url).searchParams.get("after"));
  const stop = new AbortController();
  req.signal.addEventListener("abort", () => stop.abort());
  // Membership and role can change while a run is in progress; look again from the database every 30 seconds.
  const stillAllowed = async () => {
    const ctx = await getMembershipContext(db, caller.userId, caller.organizationId);
    return !!ctx && (can(ctx, "council:use") || can(ctx, "council:history:read:org")) && canReadCouncilRecord(ctx, { ownerId: view.userId, organizationId: view.organizationId }, { userId: caller.userId, organizationId: caller.organizationId });
  };
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const frames = streamExecution(
          {
            events: (seq) => listExecutionEvents(db, { executionId: id, organizationId: caller.organizationId, afterSeq: seq }),
            status: async () => (await getExecutionView(db, id, caller.organizationId))?.status ?? null,
          },
          { afterSeq: after, signal: stop.signal, recheckAccess: stillAllowed },
        );
        for await (const f of frames) controller.enqueue(enc.encode(f));
      } catch { /* client went away or the database was unreachable; the browser will reconnect with Last-Event-ID */ }
      release();
      try { controller.close(); } catch { /* already closed */ }
    },
    cancel() { stop.abort(); release(); },
  });
  return new Response(body, { headers: {
    "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "private, no-cache, no-transform",
    Connection: "keep-alive", "X-Accel-Buffering": "no", "X-Content-Type-Options": "nosniff",
  } });
}
