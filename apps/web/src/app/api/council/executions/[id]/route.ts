import { getExecutionResult, getExecutionView, getPrisma } from "@quantara/db";
import { getCouncilCaller } from "@/lib/council-caller";
import { readConsultation } from "@/server/council-service";
import { fail, json, unauthorized } from "../../_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCouncilCaller();
  if (!caller) return unauthorized();
  const { id } = await params;
  const db = getPrisma();
  const r = await readConsultation(caller, id, { getView: (i, o) => getExecutionView(db, i, o), getResult: (i, o) => getExecutionResult(db, i, o) });
  return r.ok ? json({ consultation: r.consultation }) : fail(r);
}
