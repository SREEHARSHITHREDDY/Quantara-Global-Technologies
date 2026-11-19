# Testing

Check chain (run from the repository root):
```
pnpm typecheck && pnpm typecheck:db && pnpm test && pnpm test:db
```
`pnpm verify:offline` runs schema validation, typecheck, unit tests and the production build without a database.

| Suite | Command | Needs |
|---|---|---|
| Unit tests (content, rbac, council, auth, worker, web) | `pnpm test` | PostgreSQL for the worker integration test only |
| Database integration | `pnpm test:db` | PostgreSQL running locally; each run creates and migrates a throwaway database |
| Web only | `pnpm --filter @quantara/web test` | nothing |

Last recorded owner run (2026-11-19): 130 web, 60 council, 29 auth, 16 worker, 14 rbac, 11 content, 112 database tests, all passing.

## What is covered
* Permissions matrix and default-deny behavior (`packages/rbac`).
* Council: state machine, budgets, orchestration scenarios, approvals classification, report building.
* Database: constraints, tenant isolation, atomic budget reservation, audit immutability, approvals, event purge.
* API boundaries (`apps/web/src/app/api/council/routes.test.ts`): 401 when signed out on every route, 403 on cross-site or origin-less POSTs, bad format, bad JSON and oversized bodies refused.
* Event stream: resume, cap per user, mid-stream access revocation, fail-closed on errors.
* Security headers, staff access (`requireStaff`), report export, dashboard and admin helpers.

## Not covered yet
Browser end-to-end tests, an automated security scan, load tests, accessibility audit, and any test against a real AI provider. Pages have not been visually checked in a browser.
