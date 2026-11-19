# Security

## Controls in place
| Area | Control |
|---|---|
| Authentication | Better Auth: email verification, password reset, two-factor, session lifetime 8 hours, secure httpOnly cookies in production |
| Brute force | Database-backed rate limits on sign-in, sign-up, password reset and two-factor |
| Authorization | Role matrix in `packages/rbac`, default deny, resolved from the database on each request; staff permissions only inside the STAFF organization |
| Staff access | Separate `/staff` entrance, not linked from the public site; non-staff receive 404 on admin pages |
| Tenant isolation | `organizationId` on every Council row; composite foreign keys and triggers enforce it in PostgreSQL |
| CSRF | Same-origin check on every state-changing Council route |
| Input | Zod validation, body size limits on API routes |
| Streams | Cap of 5 per user; access re-checked every 30 s; fail closed |
| Audit | Immutable `AuditLog`; report exports, approvals and plan changes are recorded; export audit is written before content is returned |
| Data retention | Agent events of finished consultations are purged after 90 days; reports are kept |
| Headers | HSTS, nosniff, frame denial, referrer and permissions policies, and a baseline CSP (`frame-ancestors`, `object-src`, `base-uri`, `form-action`) |
| Uploads | Resumes stored in a private directory that the site does not serve |
| AI | Agents have no tools and cannot act; sensitive actions need a human approval; output labelled simulated or AI-generated |

## Not done yet
* Strict nonce-based `script-src` CSP (needs browser testing).
* CAPTCHA on public forms (needs Turnstile keys).
* Separation of duties on approvals: the requester can currently approve their own request.
* Provider key storage screens and encryption at rest for keys entered in the admin portal.
* Independent penetration test and legal review.

## Operational duties
Keep `.env` out of git; generate `BETTER_AUTH_SECRET`, `APP_ENCRYPTION_KEY` and `APP_IP_HASH_SALT` with `openssl`; serve only over HTTPS; restrict database access to the web and worker hosts; back up the database; restrict who is granted staff roles (`pnpm --filter @quantara/db staff:grant`).

## Reporting
Report vulnerabilities privately to the Quantara owners; do not open a public issue.
