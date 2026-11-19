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

## Admin foundation (staff area)
Built: `/admin` (overview), `/admin/enquiries` (list, status filter, pagination) and `/admin/enquiries/[id]` (full detail, change status), `/admin/settings` (contact email/phone/address, legal name, registration number, LinkedIn/X, notification recipients). Access is resolved from the database on every request (`requireStaff`): signed-out visitors go to `/sign-in`; customers and staff without the permission get a 404; server actions re-check the permission. Status changes and settings changes are written to the audit log (settings log key names only, never values). The first staff member is created with `pnpm --filter @quantara/db staff:grant -- <email> super_admin` after signing up.
* ✅ Verified here: 8 tests of the access guard (signed-out, customer, wrong permission, banned user, suspended staff org, role matrix) and 5 of settings validation; typecheck; production build.
* ✅ Verified by the owner (`pnpm test:db`): `tests/admin.int.test.ts` (7 tests: staff lookup, customer admins have no platform permissions, grant command, enquiry list/filter/paging/audit, settings save/remove/audit/public-only); first staff member granted. 🟡 The admin pages have not yet been clicked through in a browser.
* ✅ Settings are now shown on the public site: footer (email, phone, address, LinkedIn/X, legal name, registration number) and the contact page. Only what is filled in appears; nothing is hardcoded. Pages refresh when settings are saved and at most every 5 minutes otherwise. Unit-tested (5 tests) and builds; 🟡 not yet seen in a browser.
* Not built yet: enquiry notification emails, leads, careers, insights, users and audit-log screens.

## Careers (public jobs, applications, admin)
Built: `/careers` (open roles), `/careers/[slug]` (role detail with application form and resume upload), `/admin/jobs` (list, create, edit; publish needs `job:publish`), `/admin/applications` (list with filters, detail with status history and notes, staff-only resume download that is audit-logged). A job is public only when PUBLISHED and before its closing date. One application per email per job (a repeat returns the original reference). Resumes: PDF/DOCX/DOC only, identified by file content not name, up to 5 MB, stored under a generated key in a private location (never a public URL), removed again if saving fails. Honeypot, minimum fill time, and per-IP and per-email limits apply; the database also enforces consent and the size limit.
* ✅ Verified here (no database): 18 new tests (file-content detection, filename cleaning, the whole submission pipeline with fake storage, path-traversal block, orphan-file cleanup, rate limits, helpers); typecheck; production build.
* ✅ Verified by the owner on 2026-11-18 (`pnpm test:db`: 66 tests in 7 files; web: 50 tests): `tests/careers.int.test.ts` (9 tests: open/closed/draft visibility, publish permission, slug rules, applications incl. concurrent duplicates, database checks, status history, audit of status changes and resume downloads). 🟡 The careers pages and resume upload have not yet been clicked through in a browser.
* 🟠 Resume storage uses a private folder on the server (`RESUME_STORAGE_DIR`; in development `.data/resumes`, git-ignored). **Production must set `RESUME_STORAGE_DIR` to a persistent private directory, or applications are refused.** An S3-compatible bucket adapter is not built (awaiting storage credentials). Notification emails to HR are not built. Virus scanning is not built.

## Insights (articles)
Built: `/insights` (published articles, category filter, pagination), `/insights/[slug]` (article page with SEO title/description/canonical, Open Graph and Article structured data), `/admin/insights` (list, create, edit; publishing needs `insight:publish`; categories, tags, SEO fields). An article is public only when PUBLISHED and its publication date has arrived. Article text is rendered by a small safe formatter (headings, lists, quotes, bold, https links) that never inserts HTML, so article content cannot inject scripts.
* ✅ Verified here (no database): 11 new tests (safe formatter incl. script and `javascript:` link handling, tag parsing, visibility rule); typecheck; production build.
* ✅ Verified by the owner on 2026-11-18 (`pnpm test:db`: 71 tests in 8 files; web: 55 tests): `tests/insights.int.test.ts` (5 tests: visibility, category filter and paging, publishedAt kept on edit, author/category/tag creation, publish permission, duplicate slug, database slug check). 🟡 The article pages have not yet been clicked through in a browser.
* Not built yet: featured images (needs file storage), scheduling a future publish date from the editor, a review/approval step, search, RSS, sitemap.

## Customer authentication (sign-up, sign-in, email verification, password reset, two-factor)
Built: `/sign-up`, `/sign-in`, `/verify-email`, `/forgot-password`, `/reset-password`, `/two-factor`, `/account` (workspace, two-factor setup with QR code and backup codes, change password, sign out other devices), Better Auth API at `/api/auth/*`, header Sign in / Account link. Every self-registered customer gets their own CLIENT workspace with themselves as admin (`ensureCustomerWorkspace`; platform permissions never apply to CLIENT organizations).
* ✅ Verified here (no database): 29 auth tests on Better Auth's in-memory adapter, including the full two-factor cycle with computed authenticator codes (enrol, wrong code rejected, activation, code required at sign-in, backup code works once, disable needs password, activation rotates the session); ResendMailer request handling with a fake `fetch` (5 tests); typecheck; production build (37 pages); all new pages render; `/account` redirects signed-out visitors to `/sign-in`; authentication refuses to start in production without `BETTER_AUTH_SECRET`.
* ✅ Verified by the owner on 2026-11-18 (PostgreSQL 15, `pnpm test:db`: 57 tests passed in 6 files): the same flows through the **Prisma adapter on real PostgreSQL** (`tests/auth.int.test.ts`: register/verify/sign-in, argon2id hash, workspace + permissions, suspended user, password reset incl. session revocation and one-time token, two-factor incl. backup code, database rate limiting returns 429) and workspace provisioning (`tests/workspace.int.test.ts`). Web tests: 33 passed. Browser: sign-up, verification link (printed in the dev terminal) and sign-in gate checked by the owner.
* 🟡 Unverified: the browser screens themselves (forms, QR code rendering, redirects after two-factor). Try them locally.
* ⏳ Real email delivery: `ResendMailer` is written but needs `RESEND_API_KEY` and `MAIL_FROM` (a sender on a domain verified in Resend). In development, emails (verification and reset links) are printed in the terminal running `pnpm dev`. In production without a provider, sending fails loudly and sign-up reports an error; it never pretends an email was sent.
* **Schema change:** added the `RateLimit` model (Better Auth's database rate limiter; it would have failed at runtime without it). Needs a new migration, generated on your machine (see below). Found by comparing the schema with Better Auth's own generated schema: all other Better Auth tables matched.
* Design notes: password minimum is 12 characters, sessions last 8 hours, reset links last 1 hour, verification links 24 hours. A user invited to an existing workspace would currently also receive their own workspace (invitation acceptance screens are not built yet). No CAPTCHA yet. `getMembershipContext` typing against Prisma is checked by `pnpm typecheck:db`.

## AI Executive Council — Stage 1 (foundations, mock mode)
| Item | State |
|---|---|
| Stage 1 verified by owner: 22 council unit tests, 72 database tests (seed, agents, plan default) | ✅ verified on owner's machine |
| `@quantara/council` package: provider port, Mock provider (10 scenarios), 10 agent definitions, assessment schema with evidence claims, labels, 3-level provider resolution, access plans, 8 templates | ✅ 22 unit tests pass in the build sandbox (not yet run by owner) |
| `CouncilPlan` + Organization fields; seed of 10 Agent rows; staff org ENTERPRISE, clients DISABLED | ✅ verified (migration `council_access` applied, seed test passes) |

## AI Executive Council — Stage 2 (orchestration core, mock mode)
| Item | State |
|---|---|
| Execution state machine (QUEUED → CLASSIFYING → ASSESSING → REVIEWING → CONSOLIDATING → terminal); stale and illegal transitions rejected | ⚠️ 42 council unit tests pass in the sandbox; not yet run by owner |
| Orchestrator: parallel assessments, one retry on provider error or invalid JSON, CEO synthesis, disagreement records, budget checks, cancel, deadline, resume without repeating finished agents | ⚠️ same; all 10 mock scenarios covered |
| Atomic budget reservation (row lock; concurrency limit; monthly tokens and cost) and Postgres execution store | ⚠️ **database tests written, never executed** (`tests/council.int.test.ts`); migration `council_orchestration` must be generated |
| Participant selection is deterministic (template or explicit list). The CEO does not choose by a model call, and there is no model-driven review round yet | ℹ️ by design for now |
| Enum note: the design's COMPLETED is the existing SUCCEEDED status | ℹ️ |
| Worker handler, SSE, screens, reports (20 sections), approvals, real provider adapters, documents, memory | ❌ not built |

## AI Executive Council — Stage 3 (worker, API, event stream)
| Item | State |
|---|---|
| Stage 2 verified by owner: 42 council unit tests, 88 database tests including 6-way parallel budget reservation | ✅ verified on owner's machine |
| `council.execute` worker handler (resume after crash, ends the execution after the last failed attempt, provider unavailable handled) | ⚠️ 6 unit tests pass in sandbox; not yet run by owner |
| Stale-execution sweeper (past-deadline → TIMED_OUT, abandoned → FAILED) every 5 min in the worker | ⚠️ database test written, unrun |
| Start / read / cancel service with plan, mode, template, provider, budget, concurrency and per-user rate checks | ⚠️ 26 unit tests pass in sandbox; not yet run by owner |
| SSE stream with replay by Last-Event-ID, keep-alive, end event, no early end | ⚠️ unit tests pass; **never run against a real browser or database** |
| API routes `POST /api/council/executions`, `GET .../[id]`, `POST .../[id]/cancel`, `GET .../[id]/events` (origin check, JSON only, size limit, org-scoped) | ⚠️ typecheck only. Not exercised by any test or browser |
| Web → queue sender (`createSender`) | ⚠️ typecheck only. Needs the worker to have run once so the queues exist |
| `council:plan` script to enable a workspace (trial or standard) | ⚠️ unrun |
| Not yet: 20-section report, approvals, real provider adapters, documents, SSE re-check of membership during a long stream, SSE per-user connection cap, event retention purge | ❌ |

## AI Executive Council — Stage 4 (customer pages)
| Item | State |
|---|---|
| Stage 3 verified by owner: 46 council, 86 web, 16 worker tests, 95 database tests | ✅ verified on owner's machine |
| Progress reducer `lib/council-progress.ts` (replay-safe, tolerant of malformed events) | ⚠️ 4 unit tests pass in sandbox; not yet run by owner |
| `listExecutionsForUser` (own history, or org-wide with `council:history:read:org`) | ⚠️ 2 database tests written, unrun |
| `/council` (gates: signed out, no access, trial expired; start form; history), `/council/[id]` (live progress, result view, cancelled/failed states), nav link | ⚠️ typecheck only. **Never viewed in a browser**; live progress has not been run against a real worker |
| Result view renders the stored consolidation (label banner, disagreements, assessments, risks, missing info, approvals, claim labels, caveats) | ⚠️ typecheck only |
| 20-section report builder (`buildReport`; sections with no covering executive say "Not assessed"; nothing invented; no roadmap or sustainability content is produced by the current analysis) | ⚠️ 4 unit tests pass in sandbox |
| Export as Markdown or printable HTML (needs `council:report:export`, audited before content is returned, fails closed if the audit write fails, HTML escaped, sandboxed response headers) | ⚠️ 6 unit tests pass in sandbox; route never run in a browser |
| Access audit: exports always, and views by anyone other than the owner (`council.report.viewed` / `.exported`) | ⚠️ 1 database test written, unrun |
| Approvals: a finished consultation creates an approval request per action the executives flagged (keyword-classified into the 8 specified categories, 30-day expiry, idempotent); people with `council:approval:decide` approve or reject once with a note (required on rejection); concurrent decisions: one wins; expired requests cannot be approved; every decision audited; others see only their own consultations' requests; approving records a decision only and executes nothing | ⚠️ 10 council + 6 service unit tests pass in sandbox; 6 database tests written, unrun; pages never viewed in a browser |
| Dashboard on `/council`: sessions, running now, completed reports, approvals waiting, usage this month against the budget (budget shown to organization-wide viewers only), recent activity; own scope or organization scope by permission | ⚠️ 2 helper unit tests pass in sandbox; 2 database tests written, unrun; page not viewed in a browser. "Recent meetings" is not shown because Council Meeting mode is not built |
| Not yet: native PDF export; separation-of-duties rule (requester may currently approve their own request); database CHECK that a decided request has a decider | ❌ |

## Executive team pages (public)
| Item | State |
|---|---|
| `/executives` (4 groups, 10 cards) and `/executives/[code]` (focus, questions asked, what you receive, peers); homepage council section rebuilt as a product strip; footer link | ⚠️ builds, typechecks, 2 unit tests + route tests pass in sandbox; **not viewed in a browser** |
| Content comes from the council package definitions; taglines are our own wording. A visible notice says assessments are simulated until a live provider is connected | ✅ by construction |

## Council admin portal (staff)
| Item | State |
|---|---|
| `/admin/council`: platform usage this month, customer workspaces with plan and usage, search; `/admin/council/[orgId]`: change plan (Disabled, Trial with days, Standard, Enterprise; concurrency override), recent sessions (operational data only, no prompts or results); `/admin/council/audit`: council audit log with workspace filter | ⚠️ builds, typechecks; 3 validation unit tests pass in sandbox; 4 database tests written, unrun; **never viewed in a browser** |
| Permissions: view needs `ai:usage:read`, plan changes need `ai:provider:manage` (re-checked on every submit and audited as `council.plan.set`), audit log needs `audit:read`; staff organizations are never listed | ⚠️ as above |
| Not yet: provider credential management, agent configuration screens, org-level provider restrictions (need real adapters first) | ❌ |

## Header and staff access
| Item | State |
|---|---|
| Header: no wrapping (nowrap items, desktop menu from the xl breakpoint), no duplicate Council link, Sign out added, Admin link removed from the public site | ⚠️ typecheck only; **not viewed in a browser** |
| Staff entrance `/staff` (own sign-in page, not linked or indexed; signed-out admin visitors are sent here; non-staff get 404 from `/admin`) | ⚠️ unit test updated; not viewed in a browser |

## AI Executive Council — Stage 1 details
| Item | State |
|---|---|
| Real Anthropic / OpenAI adapters, orchestrator, worker handler, SSE, screens, reports, approvals, documents, memory | ❌ not built (later stages) |
| Provider keys | ⏳ awaiting credentials; everything runs as SIMULATED ANALYSIS until then |

## Hardening pass
- ✅ Per-user cap of 5 concurrent event streams (429 `too_many_streams`), unit-tested
- ✅ Mid-stream access re-check every 30 s from the database; revoked or erroring checks end the stream (fail closed), unit-tested
- ✅ Daily purge of agent events for finished executions older than 90 days (reports kept); DB-tested; scheduled in the worker
- ✅ Baseline Content-Security-Policy (frame-ancestors, object-src, base-uri, form-action) plus existing headers, in `lib/security-headers.ts`, unit-tested
- ✅ Route-boundary tests: 401 signed out on every council route; 403 on cross-site or origin-less POSTs; bad format / bad JSON / oversized body refused
- ⚠️ Unverified in a browser: the CSP has no `script-src`, so pages should be unaffected, but check the console once
- ❌ Strict nonce-based `script-src` (needs browser testing) and CAPTCHA (needs Turnstile keys) still pending

## Approvals separation of duties
- ✅ Requester cannot decide own request (403 `own_request`); opt-out env `COUNCIL_ALLOW_SELF_APPROVAL=1`; DB-tested and service-tested
- ⚠️ With the default, a solo owner who is the only approver cannot approve their own test requests: set the opt-out or add a second admin

## Contact details
- ✅ General email, careers/HR email, phone, address, LinkedIn and X come from site settings; shown on the Contact page and footer; `settings:set` command saves them (audited)
- ⏳ Phone, LinkedIn, address: not yet provided
- ⏳ Email sending: needs Resend domain verification and API key

## Documentation
- ✅ ARCHITECTURE, AGENTS, API, SECURITY, TESTING, DEPLOYMENT written from the code
- ⚠️ DEPLOYMENT has not been rehearsed on a hosting platform

## Vercel build
- ✅ Build now generates the Prisma client first (`apps/web` build script) and pins Node 22.x; fixes "Can't resolve ./generated/client"
- ⚠️ Unverified: the sandbox cannot run `prisma generate`, so the first Vercel build is the real test
- ⚠️ Vercel hosts the website only; the worker needs an always-on host, resumes need S3 (see docs/DEPLOYMENT.md)

## Open Council preview
- ✅ New customer workspaces start on STANDARD by default (`COUNCIL_DEFAULT_PLAN`; unrecognised values close access); audited as a system action
- ✅ `council:plan -- --all STANDARD` opens every existing customer workspace still disabled; unit-tested and DB-tested
- ✅ Preview notice on the Council page when only the Mock provider is available; every report is labelled SIMULATED ANALYSIS
- ⚠️ Production needs `COUNCIL_ENABLE_MOCK=1` on web and worker for the demo; with real AI keys, switch the default to DISABLED or TRIAL first

## Newsletter, SEO and error pages
- ✅ Newsletter signup (footer): double opt-in, hashed tokens, 7-day confirm window, confirm and unsubscribe need a button press, same reply for known and unknown addresses, rate limits per IP and per email, honeypot; unit-tested and DB-tested
- ⚠️ Delivery depends on Resend (`RESEND_API_KEY`, `MAIL_FROM`); in development the emails print in the server console
- ✅ `/sitemap.xml`, `/robots.txt` (private areas excluded; tested), custom 404 and error pages
- ❌ No admin screen for subscribers yet, and no way to send a newsletter from the site

## Menu and motion layer
- Left-hand burger menu (slide-out drawer, focus trap, Esc, scroll lock) and a more animated site: aurora hero, executive orbit, count-up stats, spotlight cards, marquee, scroll-driven timeline, scroll progress bar. Uses the `motion` package; honours reduced-motion.
- Verified: typecheck, 144 web tests, production build; desktop and mobile rendered and viewed in a headless Chrome in the sandbox.
- Unverified: real devices, Safari, and the owner's own browser.

## Not built ❌
Real AI providers and provider/agent admin screens (need API keys) · document upload and object storage · CAPTCHA (needs Turnstile keys) · strict nonce CSP · browser end-to-end and security suites · Council Meeting mode, comparison and memory · native PDF export · legal review · hosting rehearsal

## Findings needing attention
* Model count is **55**, not ~60.
* Market statistics: 5 sourced; 8 profile claims are unsourced and kept unpublished. Verify: Gartner power PR URL resolves; McKinsey publication date (2026-04-28 vs 04-20); Nasscom–Zinnov primary release (currently via Business Today).
* Contact details, legal entity name, leadership and social links are intentionally absent; they must be entered via CMS settings.
* Audit-log purges require a DBA to disable the immutability trigger.
