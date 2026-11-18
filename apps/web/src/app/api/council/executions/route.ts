import { checkJsonPost } from "@/lib/same-origin";
import { getCouncilCaller } from "@/lib/council-caller";
import { councilStartDeps, siteOrigin } from "@/server/council-runtime";
import { startConsultation } from "@/server/council-service";
import { fail, json, unauthorized } from "../_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const MAX_BODY_BYTES = 64 * 1024;

/** Starts a consultation. Returns 202 with the execution id; progress arrives on the events stream. */
export async function POST(req: Request) {
  const guard = checkJsonPost(req, siteOrigin());
  if (!guard.ok) return json({ error: { code: "refused", message: guard.message } }, guard.status);
  const caller = await getCouncilCaller();
  if (!caller) return unauthorized();
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ error: { code: "too_large", message: "Request is too large." } }, 413);
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: { code: "too_large", message: "Request is too large." } }, 413);
  let body: unknown; try { body = JSON.parse(text); } catch { return json({ error: { code: "invalid_json", message: "Send valid JSON." } }, 400); }
  const r = await startConsultation(caller, body, councilStartDeps());
  return r.ok ? json({ executionId: r.executionId }, 202) : fail(r);
}
