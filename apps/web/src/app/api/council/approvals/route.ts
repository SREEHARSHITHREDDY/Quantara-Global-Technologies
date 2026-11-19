import { getPrisma, listApprovals } from "@quantara/db";
import { getCouncilCaller } from "@/lib/council-caller";
import { listApprovalsFor } from "@/server/council-service";
import { fail, json, unauthorized } from "../_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const caller = await getCouncilCaller();
  if (!caller) return unauthorized();
  const db = getPrisma();
  const r = await listApprovalsFor(caller, { list: (a) => listApprovals(db, a) });
  return r.ok ? json({ canDecide: r.canDecide, approvals: r.approvals }) : fail(r);
}
