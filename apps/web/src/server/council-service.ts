import { z } from "zod";
import {
  CONSULTATION_MODES, PROVIDER_IDS, councilAccess, estimateExecution, resolveProvider, selectParticipants,
  type ConsultationMode, type ProviderId, type Rate,
} from "@quantara/council";
import type { CouncilOrgAccess, ExecutionView, ReserveInput, ReserveResult } from "@quantara/db";
import { buildReport, parseConsolidated, reportToHtml, reportToMarkdown } from "@quantara/council";
import { can, canReadCouncilRecord, type MembershipContext } from "@quantara/rbac";

export interface Caller { userId: string; organizationId: string; ctx: MembershipContext }
export type ServiceError = { ok: false; status: number; code: string; message: string; fieldErrors?: Record<string, string[] | undefined> };

export const START_LIMITS = { perUserPerHour: 20, minPromptChars: 10, maxPromptChars: 8000 } as const;

const startSchema = z.object({
  prompt: z.string().trim().min(START_LIMITS.minPromptChars, "Describe the question in at least a sentence").max(START_LIMITS.maxPromptChars, "That is too long; keep it under 8,000 characters"),
  mode: z.enum(CONSULTATION_MODES),
  participants: z.array(z.string().max(8)).max(10).optional(),
  templateId: z.string().max(60).optional(),
  provider: z.enum(PROVIDER_IDS).optional(),
});

export interface StartDeps {
  getAccess(organizationId: string): Promise<CouncilOrgAccess | null>;
  platformProviders(): Promise<ProviderId[]>;
  rateFor(provider: ProviderId): Rate | null;
  reserve(input: ReserveInput): Promise<ReserveResult>;
  enqueue(executionId: string, organizationId: string): Promise<void>;
  fail(executionId: string, organizationId: string, error: string): Promise<void>;
  hitRateLimit(key: string, windowSeconds: number, limit: number): Promise<{ allowed: boolean }>;
  now(): Date;
}

const err = (status: number, code: string, message: string, fieldErrors?: ServiceError["fieldErrors"]): ServiceError => ({ ok: false, status, code, message, fieldErrors });

export async function startConsultation(caller: Caller, raw: unknown, deps: StartDeps): Promise<{ ok: true; executionId: string } | ServiceError> {
  if (!can(caller.ctx, "council:use")) return err(403, "forbidden", "You do not have access to the Executive Council.");
  const rl = await deps.hitRateLimit(`council:start:${caller.userId}`, 3600, START_LIMITS.perUserPerHour);
  if (!rl.allowed) return err(429, "rate_limited", "Too many consultations started. Please wait a while and try again.");

  const parsed = startSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[] | undefined> = {};
    for (const i of parsed.error.issues) (fieldErrors[String(i.path[0] ?? "form")] ??= []).push(i.message);
    return err(400, "invalid_request", "Please check your request.", fieldErrors);
  }
  const input = parsed.data;

  const org = await deps.getAccess(caller.organizationId);
  if (!org) return err(403, "forbidden", "You do not have access to the Executive Council.");
  const access = councilAccess({ plan: org.plan, trialEndsAt: org.trialEndsAt, maxConcurrentOverride: org.maxConcurrentOverride }, deps.now());
  if (!access.allowed) {
    return access.reason === "trial_expired"
      ? err(403, "trial_expired", "Your Executive Council trial has ended. Contact Quantara to continue.")
      : err(403, "council_disabled", "The Executive Council is not enabled for your workspace yet. Contact Quantara to request access.");
  }
  if (!access.limits.modes.includes(input.mode as ConsultationMode)) return err(403, "mode_not_in_plan", "That consultation mode is not included in your plan.");

  const sel = selectParticipants({ mode: input.mode, participants: input.participants, templateId: input.templateId });
  if (!sel.ok) return err(400, sel.error, SELECTION_MESSAGES[sel.error], { participants: [SELECTION_MESSAGES[sel.error]] });

  const decision = resolveProvider({ platformEnabled: await deps.platformProviders(), requested: input.provider ?? null });
  if (!decision.ok) {
    return decision.reason === "requested_not_allowed"
      ? err(400, "provider_not_allowed", "That AI provider is not available for your workspace.")
      : err(503, "no_provider", "The Executive Council is not available right now. Please try again later.");
  }
  const rate = deps.rateFor(decision.provider);
  if (!rate) return err(503, "provider_not_configured", "The Executive Council is not available right now. Please try again later.");

  const estimate = estimateExecution({ participants: sel.participants.length, promptChars: input.prompt.length }, rate);
  const reserved = await deps.reserve({
    organizationId: caller.organizationId, userId: caller.userId, mode: input.mode, prompt: input.prompt,
    participants: sel.participants, providerKey: decision.provider, templateId: sel.templateId ?? null,
    estimate, maxConcurrent: access.limits.maxConcurrent,
    deadlineAt: new Date(deps.now().getTime() + access.limits.maxDurationSeconds * 1000),
  });
  if (!reserved.ok) {
    return reserved.reason === "concurrency_limit"
      ? err(429, "concurrency_limit", `You already have ${access.limits.maxConcurrent} consultation(s) running. Wait for one to finish or cancel it.`)
      : err(429, "budget_exceeded", "Your workspace has used its monthly Executive Council budget.");
  }
  try {
    await deps.enqueue(reserved.executionId, caller.organizationId);
  } catch {
    await deps.fail(reserved.executionId, caller.organizationId, "enqueue_failed").catch(() => {});
    return err(503, "queue_unavailable", "The Executive Council could not start this consultation. Please try again.");
  }
  return { ok: true, executionId: reserved.executionId };
}

const SELECTION_MESSAGES = {
  unknown_template: "That template does not exist.",
  unknown_agent: "One of the selected executives does not exist.",
  individual_needs_one_agent: "Choose exactly one executive for an individual consultation.",
  multi_needs_two_agents: "Choose at least two executives, or pick a template.",
} as const;

export async function cancelConsultation(caller: Caller, executionId: string, deps: { requestCancel(a: { executionId: string; organizationId: string; userId: string }): Promise<{ found: boolean }> }): Promise<{ ok: true } | ServiceError> {
  if (!can(caller.ctx, "council:use")) return err(403, "forbidden", "You do not have access to the Executive Council.");
  const r = await deps.requestCancel({ executionId, organizationId: caller.organizationId, userId: caller.userId });
  return r.found ? { ok: true } : err(404, "not_found", "Consultation not found.");
}

export interface ConsultationDto {
  id: string; status: string; mode: string; participants: string[]; templateId: string | null;
  error: string | null; createdAt: string; finishedAt: string | null; tokensUsed: number; reportReady: boolean; result: unknown | null;
}

/** Returns 404 (never 403) for anything the caller may not read, so existence is not revealed. */
export async function readConsultation(caller: Caller, executionId: string, deps: { getView(id: string, orgId: string): Promise<ExecutionView | null>; getResult(id: string, orgId: string): Promise<unknown | null> }): Promise<{ ok: true; consultation: ConsultationDto } | ServiceError> {
  const notFound = err(404, "not_found", "Consultation not found.");
  const view = await deps.getView(executionId, caller.organizationId);
  if (!view || !canReadCouncilRecord(caller.ctx, { ownerId: view.userId, organizationId: view.organizationId }, { userId: caller.userId, organizationId: caller.organizationId })) return notFound;
  const result = view.reportReady ? await deps.getResult(executionId, caller.organizationId) : null;
  return { ok: true, consultation: {
    id: view.id, status: view.status, mode: view.mode, participants: view.participants, templateId: view.templateId,
    error: view.error, createdAt: view.createdAt.toISOString(), finishedAt: view.finishedAt?.toISOString() ?? null,
    tokensUsed: view.tokensUsed, reportReady: view.reportReady, result,
  } };
}

export type ExportFormat = "md" | "html";
export const isExportFormat = (v: string | null): v is ExportFormat => v === "md" || v === "html";

/** Exports a finished report. Needs the export permission and read access to the record; every export is audited before any content is returned. */
export async function exportConsultation(
  caller: Caller, executionId: string, format: ExportFormat,
  deps: { getView(id: string, orgId: string): Promise<ExecutionView | null>; getResult(id: string, orgId: string): Promise<unknown | null>; audit(a: { organizationId: string; actorId: string; executionId: string; format: ExportFormat; ownerId: string }): Promise<void> },
): Promise<{ ok: true; filename: string; contentType: string; body: string } | ServiceError> {
  const notFound = err(404, "not_found", "Report not found.");
  const view = await deps.getView(executionId, caller.organizationId);
  if (!view || !canReadCouncilRecord(caller.ctx, { ownerId: view.userId, organizationId: view.organizationId }, { userId: caller.userId, organizationId: caller.organizationId })) return notFound;
  if (!can(caller.ctx, "council:report:export")) return err(403, "forbidden", "You do not have permission to export reports.");
  if (!view.reportReady) return notFound;
  const consolidated = parseConsolidated(await deps.getResult(executionId, caller.organizationId));
  if (!consolidated) return err(422, "report_unreadable", "This report cannot be exported.");
  try { await deps.audit({ organizationId: caller.organizationId, actorId: caller.userId, executionId, format, ownerId: view.userId }); }
  catch { return err(503, "audit_unavailable", "The export could not be recorded, so it was not provided. Please try again."); }
  const report = buildReport(consolidated, { prompt: view.prompt, mode: view.mode, participants: view.participants, templateId: view.templateId, createdAt: view.createdAt.toISOString() });
  const base = `quantara-council-report-${view.id.slice(0, 8)}`;
  return format === "md"
    ? { ok: true, filename: `${base}.md`, contentType: "text/markdown; charset=utf-8", body: reportToMarkdown(report, consolidated) }
    : { ok: true, filename: `${base}.html`, contentType: "text/html; charset=utf-8", body: reportToHtml(report, consolidated) };
}
