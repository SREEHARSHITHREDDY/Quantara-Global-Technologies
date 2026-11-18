import { getPrisma, requestCancel } from "@quantara/db";
import { checkOrigin } from "@/lib/same-origin";
import { getCouncilCaller } from "@/lib/council-caller";
import { siteOrigin } from "@/server/council-runtime";
import { cancelConsultation } from "@/server/council-service";
import { fail, json, unauthorized } from "../../../_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = checkOrigin(req, siteOrigin());
  if (!guard.ok) return json({ error: { code: "refused", message: guard.message } }, guard.status);
  const caller = await getCouncilCaller();
  if (!caller) return unauthorized();
  const { id } = await params;
  const db = getPrisma();
  const r = await cancelConsultation(caller, id, { requestCancel: (a) => requestCancel(db, a) });
  return r.ok ? json({ ok: true }, 202) : fail(r);
}
