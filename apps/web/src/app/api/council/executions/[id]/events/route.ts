import { canReadCouncilRecord } from "@quantara/rbac";
import { getExecutionView, getPrisma, listExecutionEvents } from "@quantara/db";
import { getCouncilCaller } from "@/lib/council-caller";
import { parseAfter, streamExecution } from "@/server/council-events";
import { json, unauthorized } from "../../../_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const after = parseAfter(req.headers.get("last-event-id"), new URL(req.url).searchParams.get("after"));
  const stop = new AbortController();
  req.signal.addEventListener("abort", () => stop.abort());
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const frames = streamExecution(
          {
            events: (seq) => listExecutionEvents(db, { executionId: id, organizationId: caller.organizationId, afterSeq: seq }),
            status: async () => (await getExecutionView(db, id, caller.organizationId))?.status ?? null,
          },
          { afterSeq: after, signal: stop.signal },
        );
        for await (const f of frames) controller.enqueue(enc.encode(f));
      } catch { /* client went away or the database was unreachable; the browser will reconnect with Last-Event-ID */ }
      try { controller.close(); } catch { /* already closed */ }
    },
    cancel() { stop.abort(); },
  });
  return new Response(body, { headers: {
    "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "private, no-cache, no-transform",
    Connection: "keep-alive", "X-Accel-Buffering": "no", "X-Content-Type-Options": "nosniff",
  } });
}
