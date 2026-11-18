# Executive AI Council: design (for review before building)

Status: **approved with the changes in section 13 (2026-11-18)**. Stage 1 is being built; later stages are not. The database tables for it already exist (Agent, AgentConfig, Conversation, Message, Execution, AgentTask, AgentMessage, Conflict, AgentEvent, Report, ApprovalRequest, Document, UsageRecord, ProviderConfig) and are covered by the schema tests. The `council.execute` background queue is declared but has no handler.

## 1. Decisions already made
| Decision | Choice |
|---|---|
| AI provider | **Provider-neutral.** Agents never call a vendor directly. Anthropic and OpenAI adapters plus a Mock adapter. Customers choose from the providers the platform has enabled. |
| API keys | None yet. Everything runs on the **Mock provider** until keys are added in the admin portal. Mock output is always labelled "simulated" and can never be mistaken for real analysis. |
| Agents | All 10 are created now: CEO, CFO, CTO, COO, CHRO, CMO, CRO, CISO, CLO, CSO. The CEO is the supervisor. |
| Access | Decided later. Built as an **entitlement** the Council checks (section 7), so a subscription can be attached without changing the Council. |

## 2. Layers
```
Web app (/council)  --enqueue-->  pg-boss queue "council.execute"  -->  Worker
   |  reads events (SSE)                                                  |
   +---------------------- PostgreSQL (state, events, reports) <----------+
                                                  Worker -> Orchestrator -> Agents -> LLM provider (neutral port)
```
* The web app never runs agents. It authorizes, creates an `Execution` row, enqueues a job (IDs only) and streams progress.
* The worker re-loads the execution from the database and **re-checks authorization and budgets** before doing anything.
* Every step is written as an `AgentEvent`; the browser follows them over Server-Sent Events (SSE) with `Last-Event-ID` resume, so a reload loses nothing.

## 3. Provider port
A single interface the orchestrator depends on:
`generate({ system, messages, schema, model, maxOutputTokens, signal }) -> { json, usage:{inputTokens,outputTokens}, provider, model }`.
* Adapters: `AnthropicProvider`, `OpenAIProvider`, `MockProvider`.
* Structured output: every agent answers with a JSON object validated by Zod. Invalid output is retried once with the error, then recorded as a failed task (never silently accepted).
* Cost is computed from the per-provider prices in `ProviderConfig` and written to `UsageRecord`.
* Fallback order and timeouts come from `ProviderConfig`. Keys are read from environment variables or stored encrypted (AES-256-GCM, master key from the environment). A key is never returned to the browser or logged.
* **User choice:** the new-consultation form lists enabled providers and models; the choice is stored on the execution. An admin can restrict which providers/models customers see.
* **Mock provider:** deterministic, role-aware templated answers that exercise every code path (disagreements, missing information, clarification requests, approvals). Used for tests and for the screens until real keys exist.

## 4. Agents
Each agent has: a role prompt (responsibilities from the specification), a JSON output schema, allowed tools (none initially: analysis only), and a hard rule block shared by all agents:
* They are AI simulations, not officers. They **never invent** Quantara's financials, employees, clients, contracts, registrations, legal status or performance.
* Missing information is listed explicitly; assumptions are labelled. Every statement in a report is tagged **verified / user-provided / external research / assumption**.
* They analyse and recommend; they never take sensitive actions (section 6).
Prompts are versioned files in the repository, with the prompt version stored on each task for traceability. Admins can tune temperature, token limits and enable/disable agents (`AgentConfig`), but cannot remove the safety rules.

## 5. Orchestration (the CEO-led flow)
1. **Authorize**: session, organization membership, `council:use`, entitlement, budget.
2. **Classify** (CEO): problem type and relevant departments. Not all ten agents run for every question.
3. **Select** agents by mode: INDIVIDUAL (one chosen), MULTI_EXECUTIVE (chosen set), FULL_COUNCIL (CEO selects the relevant set), CEO_RECOMMENDATION (CEO reviews supplied information and decides who to consult, if any).
4. **Assess**: independent tasks run in parallel with a concurrency cap.
5. **Validate** structure; detect missing information and disagreements (stored as `Conflict`).
6. **Review round**: agents see only the findings relevant to them, may challenge, ask for clarification, or revise (`AgentMessage`).
7. **Consolidate** (CEO) into the 20-section executive report, with confidence, missing information and **human decisions required**.
8. Save the report and history; mark the execution complete.

Controls, all enforced in code and tested: maximum iterations (default 2), per-execution token and cost budgets, per-organization monthly budget, deadline and timeout, recursion prevention (an agent cannot start agents; only the orchestrator creates tasks), a hard cap on messages per execution, cancellation, and partial results (`PARTIALLY_SUCCEEDED`) when some agents fail.

## 6. Human approval
Agents may only **prepare** actions. Anything in the categories financial transfers, payments, contract signing, legally binding communications, hiring/terminating, production infrastructure changes, restricted records, or significant external actions creates an `ApprovalRequest`. Only a user with `council:approval:decide` can approve; approval, rejection and expiry are audit-logged. In this version approvals record a decision only; no agent can execute the action, because no execution tools exist.

## 7. Access (entitlement), to be finalized with you
The Council checks one function, `councilAccess(organization)`, which returns `{ allowed, plan, monthlyTokenBudget, monthlyCostBudgetUsd }`.
* **Stage 1 (what I will build):** access is granted per workspace by staff in the admin portal (plan names such as `trial` and `standard`, each with budgets). New customers start with Council **off** or on a small trial, your choice.
* **Stage 2 (later):** a payment provider (for India, Razorpay or Stripe) updates the plan automatically from subscription events. Council code does not change.
* Why this order: AI usage costs real money per request, so access should be controlled from day one; billing can be added when you have pricing.
* Needs your decision later: plans, prices, currency, trial length, what happens at the limit (stop, or ask to upgrade).

## 8. Documents
Customers can attach documents to a consultation. Upload, type check by content, size limit, and malware-scan status gate (`ScanStatus`); text is extracted and chunked by the `document.process` job and only the relevant chunks are given to agents. Documents are private to the owner/organization and never used across tenants. (Needs the private file storage also used by resumes; an S3-compatible adapter is still to be built.)

## 9. Security and privacy
Tenant isolation on every query (the database already enforces organization/user consistency with composite keys); users see only their own history unless they hold `council:history:read:org`; prompt-injection resistance (document text and user input are passed as data, never as instructions; agents cannot call tools); no secrets in prompts or logs; per-user and per-organization rate limits; every execution, approval and report access audit-logged.

## 10. Screens
`/council` (start a consultation: mode, agents, provider/model, question, documents), `/council/[id]` (live agent progress, disagreements, final report), history list, report export (PDF and Markdown), approvals inbox. Admin: provider settings and health, agent configuration, usage and cost, workspace access and budgets.

## 11. Build stages (each delivered, tested and reviewed before the next)
1. **Foundations:** provider port, Mock provider, agent definitions and prompts, seed of the 10 agents, access check. Unit tests for the port, schemas and safety rules.
2. **Orchestrator:** the flow in section 5 with budgets, timeouts and tracing, run against the Mock provider; the Hyderabad GCC scenario from the specification as the main acceptance test.
3. **Worker integration and events:** `council.execute` handler, SSE endpoint, cancellation, resume.
4. **Council screens** for customers.
5. **Reports:** the 20-section report, export, and the approvals inbox.
6. **Admin:** providers (keys, health, fallback), agent configuration, usage and cost, workspace access.
7. **Real providers:** Anthropic and OpenAI adapters, tested with recorded/faked HTTP responses; **real-key verification is only possible once you add keys** and will be marked unverified until then.
8. **Documents** (after file storage exists).

## 12. Honest limits (will also be in STATUS.md)
* Until keys are added, all agent output is simulated.
* Agent answers are AI-generated analysis, not professional advice; the CLO and CFO outputs must be verified by qualified people.
* The Anthropic/OpenAI adapters cannot be verified against the real services from the build environment.

## 13. Decisions and changes after review (2026-11-18)
**Decisions:** (1) New workspaces start with the Council **disabled**; staff enable a trial manually. (2) Organizational Intelligence Context (memory) is **designed now, built later**; it must be separate from conversation history and controlled by the customer (retain, update, delete). (3) **Consultation templates are in the first customer-facing version.**

**Added requirements**
| Priority | Addition | Where it lands |
|---|---|---|
| Critical | **Execution state machine**: CREATED, QUEUED, CLASSIFYING, ASSESSING, REVIEWING, CONSOLIDATING, COMPLETED; terminal FAILED, CANCELLED, TIMED_OUT, PARTIALLY_SUCCEEDED. Every transition validated and persisted. | Stage 2 (needs a database migration: new status values) |
| Critical | **Atomic budget reservation**: reserve the estimated cost before starting, reconcile actual usage after each provider response, release the unused part at the end. Prevents concurrent consultations exceeding the organization's budget. | Stage 2 (migration: reserved tokens/cost) |
| Critical | **Idempotent job processing and worker recovery** (resume from the persisted state; never repeat a completed step or double-charge). | Stage 3 |
| Critical | **Provider restrictions at three levels**: platform default, organization preference, per-consultation choice, each only within the level above. | Stage 1 (pure resolution function, tested) |
| High | **Evidence and source tracking**: every material claim carries claim, classification (verified / user-provided / external research / assumption), source, verification date, confidence and responsible agent. | Stage 1 (output schema) |
| High | **Consultation templates** (8 listed below). Customers can also ask free-form. | Stage 1 |
| High | **Concurrency and size limits** per plan: concurrent consultations, document size and count, execution duration, report size. | Stage 1 (plan limits), enforced in Stage 2 |
| High | **SSE**: authorization on every connection, `Last-Event-ID` replay, no cross-organization events, defined retention and cleanup. | Stage 3 |
| High | **Export and report access auditing.** | Stage 5 |
| High | **Executive Intelligence Memory** (design only for now). | Later phase |
| Medium | Executive Council Meeting mode; historical comparison of consultations. | Later phase; the architecture supports it |

**Mock provider scenarios (all 10 will exist):** successful consultation, executive disagreement, missing information, budget exhaustion, agent failure, invalid structured response, approval-required recommendation, partial execution, cancellation, timeout.

**Disagreement records** hold: the conflicting recommendations, the evidence for each, the underlying assumptions, the potential consequences, and whether it was resolved. The CEO must not force a consensus.

**Visible labels:** `SIMULATED ANALYSIS` (Mock provider), `AI-GENERATED ANALYSIS` (a real provider), `SOURCE VERIFIED` (only for a claim whose classification is "verified" AND that has a source and a verification date). A real provider never earns "verified" by itself.

**Access plans:** Disabled (default), Trial, Standard, Enterprise. These are access tiers, not prices.

**Templates:** Business Expansion (CEO, CFO, COO, CLO, CSO); Startup Feasibility (CEO, CFO, CTO, CMO, CRO); GCC Establishment (CEO, CFO, CTO, COO, CHRO, CLO); Digital Transformation (CEO, CTO, COO, CISO); Financial Risk Assessment (CEO, CFO, CLO); Cybersecurity Assessment (CTO, CISO, COO); Workforce Planning (CEO, CHRO, CFO, COO); Market Entry Strategy (CEO, CMO, CRO, CFO, CLO).

**Integration:** the Council is part of the same application, using the same authentication, organizations, database and worker. It lives in its own package (`@quantara/council`) with no dependency on the website code.
