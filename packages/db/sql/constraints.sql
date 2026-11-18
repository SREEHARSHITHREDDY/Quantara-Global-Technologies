-- Quantara: constraints Prisma cannot express (CHECKs, triggers).
-- Applied as its own migration AFTER the Prisma-generated init migration.
-- STATUS: written, NOT YET EXECUTED against PostgreSQL. Verified only by `pnpm --filter @quantara/db test:integration`.
-- Prisma ignores CHECK constraints and triggers during drift detection, so this does not cause `migrate dev` drift.

-- ───────────── Format / value CHECKs ─────────────
ALTER TABLE "Service"  ADD CONSTRAINT "Service_slug_format"  CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "Industry" ADD CONSTRAINT "Industry_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "Insight"  ADD CONSTRAINT "Insight_slug_format"  CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "Job"      ADD CONSTRAINT "Job_slug_format"      CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "organization" ADD CONSTRAINT "organization_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

ALTER TABLE "NewsletterSubscriber" ADD CONSTRAINT "NewsletterSubscriber_email_lower" CHECK ("email" = lower("email"));
ALTER TABLE "JobApplication"       ADD CONSTRAINT "JobApplication_email_lower"       CHECK ("applicantEmail" = lower("applicantEmail"));
ALTER TABLE "user"                 ADD CONSTRAINT "user_email_lower"                 CHECK ("email" = lower("email"));

-- Consent must be affirmative to store personal data.
ALTER TABLE "ContactEnquiry" ADD CONSTRAINT "ContactEnquiry_consent_true"  CHECK ("privacyConsent" IS TRUE);
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_consent_true" CHECK ("privacyConsent" IS TRUE);

ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_resume_size" CHECK ("resumeSizeBytes" > 0 AND "resumeSizeBytes" <= 10485760);
ALTER TABLE "Document"       ADD CONSTRAINT "Document_size"              CHECK ("sizeBytes" > 0);

-- ───────────── Publication integrity ─────────────
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_published_has_date" CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);
ALTER TABLE "Job"     ADD CONSTRAINT "Job_published_has_date"     CHECK ("status" <> 'PUBLISHED' OR "postedAt" IS NOT NULL);

-- A market statistic can only be published with a source AND a recorded verification.
-- (Source.publishedAt is NOT NULL, so a publication date is guaranteed.)
ALTER TABLE "MarketStatistic" ADD CONSTRAINT "MarketStatistic_published_requires_source"
  CHECK (NOT "isPublished" OR ("sourceId" IS NOT NULL AND "verifiedAt" IS NOT NULL));

-- ───────────── Council integrity ─────────────
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_budgets_positive" CHECK ("tokenBudget" > 0 AND "costBudgetUsd" > 0);
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_usage_nonnegative" CHECK ("tokensUsed" >= 0 AND "costUsd" >= 0);
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_iteration_bounded" CHECK ("iteration" >= 0 AND "maxIterations" >= 1 AND "iteration" <= "maxIterations");
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_attempt_positive"  CHECK ("attempt" >= 1 AND "tokensIn" >= 0 AND "tokensOut" >= 0 AND "costUsd" >= 0);
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_nonnegative"   CHECK ("tokensIn" >= 0 AND "tokensOut" >= 0 AND "costUsd" >= 0);
ALTER TABLE "Message" ADD CONSTRAINT "Message_agent_role_has_agent"  CHECK ("role" <> 'AGENT' OR "agentId" IS NOT NULL);
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_no_self_send" CHECK ("toAgentId" IS NULL OR "toAgentId" <> "fromAgentId");
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_decision_consistent"
  CHECK (("status" IN ('APPROVED','REJECTED') AND "decidedAt" IS NOT NULL) OR ("status" = 'PENDING' AND "decidedAt" IS NULL) OR "status" IN ('EXPIRED','CANCELLED'));
ALTER TABLE "organization" ADD CONSTRAINT "organization_budgets_nonnegative"
  CHECK (("monthlyTokenBudget" IS NULL OR "monthlyTokenBudget" >= 0) AND ("monthlyCostBudgetUsd" IS NULL OR "monthlyCostBudgetUsd" >= 0));

-- ───────────── Trigger: exactly one active AgentConfig per agent ─────────────
CREATE OR REPLACE FUNCTION quantara_one_active_agent_config() RETURNS trigger AS $$
BEGIN
  IF NEW."isActive" THEN
    PERFORM pg_advisory_xact_lock(hashtext('agentconfig:' || NEW."agentId"));
    IF EXISTS (SELECT 1 FROM "AgentConfig" WHERE "agentId" = NEW."agentId" AND "isActive" AND "id" <> NEW."id") THEN
      RAISE EXCEPTION 'agent % already has an active configuration', NEW."agentId" USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "AgentConfig_one_active" BEFORE INSERT OR UPDATE OF "isActive" ON "AgentConfig"
  FOR EACH ROW EXECUTE FUNCTION quantara_one_active_agent_config();

-- ───────────── Triggers: tenant membership + cross-table organization consistency ─────────────
CREATE OR REPLACE FUNCTION quantara_require_membership() RETURNS trigger AS $$
DECLARE uid text; BEGIN
  IF TG_TABLE_NAME = 'Document' THEN uid := NEW."ownerId"; ELSE uid := NEW."userId"; END IF;
  IF NOT EXISTS (SELECT 1 FROM "member" WHERE "organizationId" = NEW."organizationId" AND "userId" = uid) THEN
    RAISE EXCEPTION 'user % is not a member of organization %', uid, NEW."organizationId" USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "Conversation_require_member" BEFORE INSERT ON "Conversation" FOR EACH ROW EXECUTE FUNCTION quantara_require_membership();
CREATE TRIGGER "Execution_require_member"    BEFORE INSERT ON "Execution"    FOR EACH ROW EXECUTE FUNCTION quantara_require_membership();
CREATE TRIGGER "Document_require_member"     BEFORE INSERT ON "Document"     FOR EACH ROW EXECUTE FUNCTION quantara_require_membership();

CREATE OR REPLACE FUNCTION quantara_execution_org_consistency() RETURNS trigger AS $$
DECLARE exec_org text; BEGIN
  IF TG_TABLE_NAME = 'Execution' THEN
    IF NEW."meetingId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Meeting" WHERE "id" = NEW."meetingId" AND "organizationId" = NEW."organizationId") THEN
      RAISE EXCEPTION 'meeting belongs to a different organization' USING ERRCODE = '23514';
    END IF;
  ELSE -- ApprovalRequest, UsageRecord
    IF NEW."executionId" IS NOT NULL THEN
      SELECT "organizationId" INTO exec_org FROM "Execution" WHERE "id" = NEW."executionId";
      IF exec_org IS DISTINCT FROM NEW."organizationId" THEN
        RAISE EXCEPTION '% references an execution from a different organization', TG_TABLE_NAME USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "Execution_meeting_org"       BEFORE INSERT OR UPDATE OF "meetingId" ON "Execution"       FOR EACH ROW EXECUTE FUNCTION quantara_execution_org_consistency();
CREATE TRIGGER "ApprovalRequest_exec_org"    BEFORE INSERT OR UPDATE OF "executionId" ON "ApprovalRequest" FOR EACH ROW EXECUTE FUNCTION quantara_execution_org_consistency();
CREATE TRIGGER "UsageRecord_exec_org"        BEFORE INSERT OR UPDATE OF "executionId" ON "UsageRecord"     FOR EACH ROW EXECUTE FUNCTION quantara_execution_org_consistency();

-- Documents attached to an execution must be in the same org and either org-visible or owned by the executing user.
CREATE OR REPLACE FUNCTION quantara_execution_document_access() RETURNS trigger AS $$
DECLARE e RECORD; d RECORD; BEGIN
  SELECT "organizationId","userId" INTO e FROM "Execution" WHERE "id" = NEW."executionId";
  SELECT "organizationId","ownerId","visibility","deletedAt" INTO d FROM "Document" WHERE "id" = NEW."documentId";
  IF e."organizationId" IS NULL OR d."organizationId" IS NULL THEN RAISE EXCEPTION 'execution or document not found' USING ERRCODE = '23503'; END IF;
  IF e."organizationId" <> d."organizationId" THEN RAISE EXCEPTION 'document belongs to a different organization' USING ERRCODE = '23514'; END IF;
  IF d."deletedAt" IS NOT NULL THEN RAISE EXCEPTION 'document has been deleted' USING ERRCODE = '23514'; END IF;
  IF d."visibility" <> 'ORGANIZATION' AND d."ownerId" <> e."userId" THEN
    RAISE EXCEPTION 'document is private to another user' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "ExecutionDocument_access" BEFORE INSERT ON "ExecutionDocument" FOR EACH ROW EXECUTE FUNCTION quantara_execution_document_access();

-- ───────────── Trigger: DocumentChunk full-text vector ─────────────
CREATE OR REPLACE FUNCTION quantara_chunk_search() RETURNS trigger AS $$
BEGIN NEW."search" := to_tsvector('english', coalesce(NEW."text", '')); RETURN NEW; END $$ LANGUAGE plpgsql;
CREATE TRIGGER "DocumentChunk_search" BEFORE INSERT OR UPDATE OF "text" ON "DocumentChunk"
  FOR EACH ROW EXECUTE FUNCTION quantara_chunk_search();

-- ───────────── Immutable audit log ─────────────
-- Rows cannot be deleted or edited. The only permitted change is the FK SET NULL when an organization is removed.
-- Retention purges must be run by a DBA who first disables this trigger (documented in DATABASE.md).
CREATE OR REPLACE FUNCTION quantara_audit_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'AuditLog rows are immutable' USING ERRCODE = '42501'; END IF;
  IF (to_jsonb(NEW) - 'organizationId') IS DISTINCT FROM (to_jsonb(OLD) - 'organizationId') OR NEW."organizationId" IS NOT NULL THEN
    RAISE EXCEPTION 'AuditLog rows are immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "AuditLog_immutable" BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION quantara_audit_immutable();
