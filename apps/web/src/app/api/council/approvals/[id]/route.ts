import { decideApproval, getPrisma } from "@quantara/db";
import { checkJsonPost } from "@/lib/same-origin";
import { getCouncilCaller } from "@/lib/council-caller";
import { siteOrigin } from "@/server/council-runtime";
import { decideApprovalRequest } from "@/server/council-service";
import { fail, json, unauthorized } from "../../_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const MAX_BODY_BYTES = 8 * 1024;

/** Approve or reject one request. Recording the decision is all it does; no action is carried out. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = checkJsonPost(req, siteOrigin());
  if (!guard.ok) return json({ error: { code: "refused", message: guard.message } }, guard.status);
  const caller = await getCouncilCaller();
  if (!caller) return unauthorized();
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: { code: "too_large", message: "Request is too large." } }, 413);
  let body: unknown; try { body = JSON.parse(text); } catch { return json({ error: { code: "invalid_json", message: "Send valid JSON." } }, 400); }
  const { id } = await params;
  const db = getPrisma();
  const r = await decideApprovalRequest(caller, id, body, { decide: (a) => decideApproval(db, { ...a, allowSelf: process.env.COUNCIL_ALLOW_SELF_APPROVAL === "1" }) });
  return r.ok ? json({ approval: r.approval }) : fail(r);
}
