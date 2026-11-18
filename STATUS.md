# Quantara platform: implementation status

Legend: ✅ verified (executed, passing) · 🟡 written, **unverified** · ⏳ awaiting credentials · ❌ not built · 🚫 blocked

Last updated: 2026-11-18 · Phase 1 gate: **PASSED** (database validated by the owner on macOS, 2026-11-18)

## Phase 1 gate
Owner ran on macOS (Node 22.23.5, pnpm 10.0.0, **PostgreSQL 15**, Prisma 7.10.1): `pnpm install`, `db:validate`, `db:setup`, `typecheck:db`, `test:db`: all succeeded. Migrations `20261118102300_init` and `20261118102301_constraints` applied; seed ran; 31/31 DB integration tests pass. Requires Node 20.19+/22.12+/24+ (Node 23 is rejected by Prisma).
Caveat: PostgreSQL 16 is the target version; validation ran on 15. Re-run `pnpm test:db` on 16 before production. The migrations folder must be committed.

## Verified ✅ (`pnpm verify:offline` exit 0)
| Item | Evidence |
|---|---|
| Prisma schema validity (55 models, 27 enums) | Prisma's WASM validator; automated FK-index review clean |
| `@quantara/content` | 11 tests; typecheck |
| `@quantara/rbac` | 14 tests; typecheck |
| `@quantara/auth` | 18 tests against Better Auth's **in-memory** adapter (not Prisma) |
| `@quantara/worker` (pg-boss) | 10 tests incl. integration on a real local PostgreSQL 16 |
| `apps/web` | typecheck, 1 test, `next build` (Next 16.4.6), smoke test of `/api/health`, headers, homepage, design-system 404 in production |
| SQL supplement (`sql/constraints.sql`) | 32 behaviour checks on PG16 using **hand-made stub tables**, not Prisma's DDL |

## Verified by owner on real PostgreSQL ✅
Prisma migrations (init + constraints), seed, `typecheck:db`, 31 DB integration tests (tenant isolation, publication gate, audit immutability, council rules).

## Still unverified 🟡
* Better Auth against the Prisma adapter, and `getMembershipContext` against real tables (tests so far use the in-memory adapter).
* PostgreSQL 16 specifically (validated on 15).
* All later-phase database features.

## Mocked / dev-only
* `OutboxMailer` (dev/test) only; production uses `DisabledMailer` which fails loudly. ⏳ real email provider.
* Seed statistics are marked "dev-seed (unreviewed)" and unpublished unless `SEED_PUBLISH_STATS=1`.

## Phase 2 (public website), stage 1 ✅ built and verified offline
Site shell (header with mobile menu, footer), real homepage, `/services` + 9 service pages, `/industries` + 10 industry pages. Verified: typecheck, 7 web tests, production build (25 static pages), crawl of all 22 reachable pages (all 200, no broken internal links, 404 for unknown slugs).
Links to routes that do not exist yet (About, Approach, Insights, Careers, Contact, Council, legal) are hidden by `lib/routes.ts` until their pages are added. Footer shows no contact details: CMS-managed, not wired yet. Homepage "Latest insights" is omitted until published insights exist.
Not yet browser-tested visually (no browser here); review the look locally with `pnpm dev`.

## Phase 2 (public website), stage 2: built; database parts UNVERIFIED 🟡
Pages built and crawled in a production build (28 pages, no broken links): `/about`, `/approach`, `/contact`, `/privacy-policy`, `/terms`, `/cookie-policy`.
Contact form: validation (zod), explicit consent with versioned wording, honeypot, minimum-fill-time check and link-stuffing score (spam is stored with status SPAM but looks identical to the sender), per-IP and per-email rate limits, idempotency key (double submit returns the same reference), IP stored only as a salted hash.
* ✅ Verified here (no database): validation and spam/rate-limit logic (18 web tests with fakes), reference-id and rate-window helpers (2 tests), typecheck, production build.
* ✅ Verified by owner on real PostgreSQL 15: `typecheck:db` passes; `createEnquiry` (storage, service/industry linking, idempotency incl. concurrent submits, SPAM status) and `hitRateLimit` (limit, window rollover, atomic concurrent counting) pass. 37/38 on first run; the 1 failure was a wrong test assumption (enquiries have no DB lower-case CHECK); `createEnquiry` now normalises the email instead. Re-run `pnpm test:db` to confirm 38/38.
* 🟡 Server action end-to-end (browser submit to database) has not been run. Do it locally: `pnpm dev`, submit the form, then check the `ContactEnquiry` table.
* ⏳ Not sent: confirmation email to the sender and notification email to admins (no email provider configured). The confirmation page shows the reference number and does not claim an email was sent.
* ❌ No CAPTCHA/Turnstile yet (planned for the security phase). Rate limiting and honeypot are the only bot defences today.
* Operational: set `APP_IP_HASH_SALT` in production (the action refuses to run without it). Old `RateLimitBucket` rows need the retention job (not built). Behind a proxy, `X-Forwarded-For` must be set by a trusted hop.
* Legal pages are working text that describe what the site does today. **They must be reviewed by qualified counsel before launch** and updated when cookies, analytics or the Council's accounts are added. They contain no governing-law clause.

## Customer authentication (sign-up, sign-in, email verification, password reset, two-factor)
Built: `/sign-up`, `/sign-in`, `/verify-email`, `/forgot-password`, `/reset-password`, `/two-factor`, `/account` (workspace, two-factor setup with QR code and backup codes, change password, sign out other devices), Better Auth API at `/api/auth/*`, header Sign in / Account link. Every self-registered customer gets their own CLIENT workspace with themselves as admin (`ensureCustomerWorkspace`; platform permissions never apply to CLIENT organizations).
* ✅ Verified here (no database): 29 auth tests on Better Auth's in-memory adapter, including the full two-factor cycle with computed authenticator codes (enrol, wrong code rejected, activation, code required at sign-in, backup code works once, disable needs password, activation rotates the session); ResendMailer request handling with a fake `fetch` (5 tests); typecheck; production build (37 pages); all new pages render; `/account` redirects signed-out visitors to `/sign-in`; authentication refuses to start in production without `BETTER_AUTH_SECRET`.
* 🟡 Unverified until `pnpm test:db` is run after the migration below: the same flows through the **Prisma adapter on real PostgreSQL** (`tests/auth.int.test.ts`, 8 tests: register/verify/sign-in, argon2id hash, workspace + permissions, suspended user, password reset incl. session revocation and one-time token, two-factor incl. backup code, database rate limiting returns 429) and workspace provisioning (`tests/workspace.int.test.ts`, 4 tests incl. concurrency and repair). Expected total: 50 tests.
* 🟡 Unverified: the browser screens themselves (forms, QR code rendering, redirects after two-factor). Try them locally.
* ⏳ Real email delivery: `ResendMailer` is written but needs `RESEND_API_KEY` and `MAIL_FROM` (a sender on a domain verified in Resend). In development, emails (verification and reset links) are printed in the terminal running `pnpm dev`. In production without a provider, sending fails loudly and sign-up reports an error; it never pretends an email was sent.
* **Schema change:** added the `RateLimit` model (Better Auth's database rate limiter; it would have failed at runtime without it). Needs a new migration, generated on your machine (see below). Found by comparing the schema with Better Auth's own generated schema: all other Better Auth tables matched.
* Design notes: password minimum is 12 characters, sessions last 8 hours, reset links last 1 hour, verification links 24 hours. A user invited to an existing workspace would currently also receive their own workspace (invitation acceptance screens are not built yet). No CAPTCHA yet. `getMembershipContext` typing against Prisma is checked by `pnpm typecheck:db`.

## Not built ❌
Remaining public routes: /insights(+slug), /careers(+job) · careers application and newsletter forms · admin portal · Council agents, orchestration, SSE, reports, document processing · AI provider integration ⏳ · object storage ⏳ · CSP · e2e/security test suites · docs: DEPLOYMENT, ARCHITECTURE, SECURITY, API_DOCUMENTATION, TESTING, AGENTS.

## Findings needing attention
* Model count is **55**, not ~60.
* Market statistics: 5 sourced; 8 profile claims are unsourced and kept unpublished. Verify: Gartner power PR URL resolves; McKinsey publication date (2026-04-28 vs 04-20); Nasscom–Zinnov primary release (currently via Business Today).
* Contact details, legal entity name, leadership and social links are intentionally absent; they must be entered via CMS settings.
* Audit-log purges require a DBA to disable the immutability trigger.
