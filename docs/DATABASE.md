# Database design

PostgreSQL 16 + Prisma 7.10 (`@prisma/adapter-pg`). **55 models, 27 enums.** Schema: `packages/db/prisma/schema.prisma`.
Status: schema is **valid** (Prisma's own validator, run offline). Migrations have **not** been generated or applied: see `LOCAL_DATABASE_SETUP.md`.

## Domains
| Domain | Models |
|---|---|
| Identity (Better Auth) | User, Session, Account, Verification, Organization, Member, Invitation, TwoFactor |
| RBAC | Role (per organization), Permission, RolePermission |
| CMS | SiteSetting, Page, ContentBlock, Service, ServiceCapability, Industry, ServiceIndustry, ServiceRelation, Author, InsightCategory, Tag, Insight, InsightTag |
| Market evidence | Source, MarketStatistic |
| Business | ContactEnquiry, Lead, LeadNote, LeadActivity, NewsletterSubscriber |
| Careers | Job, JobApplication, ApplicationStatusEvent |
| Executive Council | Agent, AgentConfig, Conversation, Message, Meeting, MeetingParticipant, Execution, AgentTask, AgentMessage, Conflict, AgentEvent, Report, ApprovalRequest, Document, DocumentChunk, ExecutionDocument |
| Platform | AuditLog, ProviderConfig, UsageRecord, IntegrationStatus, RateLimitBucket |

## Tenancy model
* Every Council row carries `organizationId` (and `userId`/`ownerId` where private).
* **Database-enforced consistency** (not just application code):
  * Composite FKs: `Execution → Conversation (id, organizationId, userId)`, `Meeting → Conversation (id, organizationId)`, `Report → Execution (id, organizationId, userId)`, `DocumentChunk → Document (id, organizationId, ownerId)`.
  * Triggers (`sql/constraints.sql`): users must be **members** of the organization to create conversations/executions/documents; meetings, approvals and usage must reference same-organization executions; a document can be attached to an execution only if it is in the same organization and either organization-visible or owned by the executing user.
* Roles are rows **per organization**, provisioned from the code-defined matrix in `@quantara/rbac`. `Member.role` stores the role key. Platform permissions (CMS, leads, applications, AI config…) are honoured only in `STAFF` organizations. Authorization is always resolved server-side from database state (`getMembershipContext`).

## Integrity rules enforced in PostgreSQL
Consent must be true (enquiries, applications) · lower-case emails · slug format · published content must carry a publication date · **a market statistic can be published only with a source and a recorded verification** (source publication date is NOT NULL) · execution budgets/iterations bounded · agent messages need an agent · agents cannot message themselves · approval decisions consistent · one active config per agent (advisory-locked trigger) · `AuditLog` is immutable (only the FK `SET NULL` path is allowed).

## Review record (all 55 models)
| Check | Result |
|---|---|
| Prisma validation | Passes |
| Foreign keys without a leading index | 29 found → all fixed; automated re-check reports none |
| Models without `createdAt` | 4 intentionally exempt: TwoFactor (plugin-defined), ContentBlock (`updatedAt` only), Meeting (`startedAt`), ProviderConfig (`updatedAt`) |
| Required relations using `SetNull` | none |
| Unique constraints | slugs, emails, reference IDs, idempotency keys, (org, role key), (job, applicant email), (execution, seq), (agent, config version) |
| Cross-tenant references | 4 composite FKs + 5 triggers (above) |
| System roles with NULL organization (NULL-unique pitfall) | removed: roles are always per-organization |
| Partial indexes | avoided: still a Prisma preview feature; implemented with triggers instead so Prisma never reports drift |

## Deliberate design decisions
* `User` deletion cascades to that user's Council data (supports erasure requests). Users are normally **suspended**, not deleted.
* `AuditLog` keeps rows when an organization is deleted (org reference nulled).
* Provider credentials: `credentialEnvVar` (preferred) or AES-256-GCM ciphertext in `encryptedApiKey`. Never plaintext (implemented in the AI phase).
* Resumes and documents are stored as **private object-storage keys**; no public URLs exist in the schema.
* Retention purges of `AuditLog` require a DBA to disable `AuditLog_immutable` temporarily; a purge procedure is documented in the security phase.
