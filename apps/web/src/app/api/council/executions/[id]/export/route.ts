import { getExecutionResult, getExecutionView, getPrisma, recordReportAccess } from "@quantara/db";
import { getCouncilCaller } from "@/lib/council-caller";
import { exportConsultation, isExportFormat } from "@/server/council-service";
import { fail, json, unauthorized } from "../../../_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCouncilCaller();
  if (!caller) return unauthorized();
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") ?? "md";
  if (!isExportFormat(format)) return json({ error: { code: "invalid_request", message: "format must be md or html" } }, 400);
  const db = getPrisma();
  const r = await exportConsultation(caller, id, format, {
    getView: (i, o) => getExecutionView(db, i, o), getResult: (i, o) => getExecutionResult(db, i, o),
    audit: (a) => recordReportAccess(db, { ...a, action: "council.report.exported" }),
  });
  if (!r.ok) return fail(r);
  return new Response(r.body, { headers: { "Content-Type": r.contentType, "Content-Disposition": `attachment; filename="${r.filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'" } });
}
