/**
 * CSRF guard for cookie-authenticated JSON endpoints. A browser always sends Origin on cross-site POSTs;
 * it must match this site. Requests with no Origin (not from a browser page) are refused, and the body must be JSON.
 */
export function checkJsonPost(req: Request, allowedOrigin: string): { ok: true } | { ok: false; status: number; message: string } {
  const origin = req.headers.get("origin");
  let allowed: string;
  try { allowed = new URL(allowedOrigin).origin; } catch { return { ok: false, status: 500, message: "Server origin is not configured." }; }
  if (!origin || origin !== allowed) return { ok: false, status: 403, message: "Cross-site request refused." };
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return { ok: false, status: 415, message: "Send JSON." };
  return { ok: true };
}
/** Cancel has no body, so only the Origin rule applies. */
export function checkOrigin(req: Request, allowedOrigin: string): { ok: true } | { ok: false; status: number; message: string } {
  const origin = req.headers.get("origin");
  let allowed: string;
  try { allowed = new URL(allowedOrigin).origin; } catch { return { ok: false, status: 500, message: "Server origin is not configured." }; }
  return origin && origin === allowed ? { ok: true } : { ok: false, status: 403, message: "Cross-site request refused." };
}
