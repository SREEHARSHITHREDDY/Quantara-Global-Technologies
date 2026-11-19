# The Executive Council agents

Ten agents, defined in `packages/council/src/agents/definitions.ts`. The CEO leads; the others are specialists.

| Code | Role | Looks at |
|---|---|---|
| CEO | Council lead | Frames the question, selects participants, weighs and consolidates without forcing consensus |
| CFO | Finance | Budget, cash flow, unit economics, funding |
| CTO | Technology | Architecture, feasibility, build or buy, delivery risk |
| COO | Operations | Execution, capacity, process, supply chain |
| CMO | Marketing | Positioning, demand, brand, channels |
| CRO | Revenue | Pricing, sales, pipeline, retention |
| CHRO | People | Hiring, skills, culture, retention |
| CLO | Legal and compliance | Regulatory and contractual exposure; flags where qualified counsel is needed |
| CISO | Security | Threats, data protection, access control, resilience |
| CSO | Strategy | Competition, timing, partnerships, options |

## Consultation modes
`INDIVIDUAL` (one executive), `MULTI_EXECUTIVE` (a chosen set), `FULL_COUNCIL` (CEO selects the relevant set), `CEO_RECOMMENDATION` (CEO reviews supplied information). TRIAL plans exclude `FULL_COUNCIL`.

## Plans and limits
| Plan | Concurrent | Documents | Max duration |
|---|---|---|---|
| DISABLED | no access | | |
| TRIAL (needs an end date) | 1 | 3 | 10 min |
| STANDARD | 2 | 10 | 15 min |
| ENTERPRISE | 5 | 30 | 20 min |

Set a workspace's plan: `pnpm --filter @quantara/db council:plan -- <email> <PLAN> [trialDays]`, or from the admin portal (Council).

## Rules shared by every agent
They advise and do not decide or act; they separate what the user said, what they assume and what could be verified; "verified" needs a named source and date; missing information is listed explicitly. Claims are labelled SOURCE VERIFIED, USER PROVIDED, EXTERNAL RESEARCH (UNVERIFIED) or ASSUMPTION.

## Reports
The CEO's result becomes a 20-section report (export as Markdown or HTML). Sections 12 and 16 are always "Not assessed" because the agents have no data for them.

## Human approvals
Financial transfers, payments, contract signing, legally binding communications, hiring or terminating, production infrastructure changes, restricted records and significant external actions create an approval request. Users with `council:approval:decide` approve or reject (a rejection needs a note); requests expire after 30 days. Nothing is executed by the system.

## Current provider
Only the Mock provider exists. It is deterministic, clearly labelled, and supports test scenarios through `COUNCIL_MOCK_SCENARIO`: success, disagreement, missing_information, budget_exhaustion, agent_failure, invalid_response, approval_required, partial_execution, cancellation, timeout. Real Anthropic and OpenAI adapters are not built.
