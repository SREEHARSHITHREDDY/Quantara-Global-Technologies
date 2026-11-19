# API reference

All Council endpoints are under `/api/council`, require a signed-in session, and return JSON errors shaped `{ "error": { "code", "message", "fieldErrors"? } }`. Authorization is resolved from the database on each call.

POST routes also require a same-origin `Origin` header and `Content-Type: application/json`; otherwise they return **403** before anything else runs.

| Method and path | Purpose | Notes |
|---|---|---|
| `POST /api/council/executions` | Start a consultation | Body: `prompt` (10–8000 chars), `mode`, optional `participants` (agent codes), `templateId`, `provider`. Max body 64 KB. 202 `{ executionId }`. Limit 20 starts per user per hour. |
| `GET /api/council/executions/{id}` | Read a consultation | Own record, or any in the organization with `council:history:read:org`. |
| `GET /api/council/executions/{id}/events` | Progress stream (SSE) | Honors `Last-Event-ID`. Ends with `event: end`. Max 5 open streams per user (429 `too_many_streams`). Access is re-checked every 30 s; if revoked the stream ends with reason `access_revoked`. |
| `POST /api/council/executions/{id}/cancel` | Cancel | 202. |
| `GET /api/council/executions/{id}/export?format=md\|html` | Download the report | Needs `council:report:export`. The access is audited before content is returned. Other formats: 400. |
| `GET /api/council/approvals` | List approval requests | |
| `POST /api/council/approvals/{id}` | Decide | Body `{ "decision": "APPROVED"\|"REJECTED", "note"? }`; rejection needs a note of 3+ characters, max 1000. Max body 8 KB. Needs `council:approval:decide`. |

## Common status codes
401 signed out · 403 not permitted, wrong origin, plan or mode not allowed · 404 not found (also used to hide records you may not see) · 409 already decided · 410 expired · 413 body too large · 429 rate limited · 503 service unavailable or provider not configured.

## Other endpoints
* `GET /api/health`: liveness only (`{status:"ok"}`); it does not check the database.
* `/api/auth/*`: Better Auth (sign-up, sign-in, verification, password reset, two-factor). Sign-in is limited to 5 attempts per minute per address, sign-up to 5 per 5 minutes, password reset to 3 per 5 minutes, two-factor to 5 per minute.
* `GET /api/me/staff`: whether the signed-in user is staff.
