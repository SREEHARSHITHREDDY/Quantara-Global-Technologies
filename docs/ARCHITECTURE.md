# Architecture

## Shape
```
Browser ──► Next.js web app (apps/web) ──► PostgreSQL 15/16 (Prisma 7)
                │  enqueue (IDs only)               ▲
                ▼                                   │ state, events, reports
            pg-boss queue ──► Worker (workers/jobs) ┘
                                   └─► Orchestrator (packages/council) ─► LLM provider port (Mock today)
```
Three deployables share one repository and one database:
| Part | Path | Role |
|---|---|---|
| Web app | `apps/web` | Public site, authenticated Council pages, staff admin portal, JSON/SSE API |
| Worker | `workers/jobs` (`@quantara/worker`) | Runs Council consultations and a daily event purge; separate process |
| Database | `packages/db` | Prisma schema, SQL constraints, seed, scripts, integration tests |

Shared packages: `packages/council` (agents, orchestrator, budgets, reports, approvals), `packages/rbac` (roles and `can()`), `packages/auth` (Better Auth), `packages/content` (company content and sourced statistics).

## Request flow for a consultation
1. The browser POSTs to `/api/council/executions`. The route checks Origin, then the signed-in caller, then the service checks permission, per-user rate limit, plan, mode, provider and budgets.
2. A budget is reserved atomically and an `Execution` row is created; only IDs go on the queue.
3. The worker reloads the execution, re-checks authorization and budgets, and runs the state machine `QUEUED → CLASSIFYING → ASSESSING → REVIEWING → CONSOLIDATING → SUCCEEDED | PARTIALLY_SUCCEEDED | FAILED | CANCELLED | TIMED_OUT`.
4. Every step is written as an `AgentEvent`. The browser follows them over Server-Sent Events with `Last-Event-ID` resume, so a reload loses nothing.
5. The CEO's consolidated result is saved as a report; actions that need a person create `ApprovalRequest` rows.

## Authorization
Roles are rows per organization, provisioned from the matrix in `packages/rbac`. Authorization is resolved from the database on every request (`getMembershipContext`), never from the session cookie. Platform permissions (CMS, enquiries, audit, AI configuration) apply only inside the STAFF organization. Staff pages use `requireStaff(permission)`: signed-out visitors go to `/staff`; anyone else without the permission receives a 404.

## Tenancy
Every Council row carries `organizationId`; composite foreign keys and triggers keep references inside one organization. See `DATABASE.md`.

## Design decisions
* Agents advise and never act. No execution tools exist; approvals record a human decision only.
* AI output is always labelled (SIMULATED ANALYSIS for Mock, AI-GENERATED ANALYSIS for real providers) and claims carry source labels.
* Provider-neutral port: adding Anthropic or OpenAI means adding an adapter, not changing agents.
* Audit log is immutable at the database level.
