// Liveness only. A database readiness probe is added once the DB layer is verified.
export const dynamic = "force-dynamic";
export function GET() { return Response.json({ status: "ok", service: "quantara-web" }, { headers: { "Cache-Control": "no-store" } }); }
