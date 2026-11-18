export const COUNCIL_PLANS = ["DISABLED", "TRIAL", "STANDARD", "ENTERPRISE"] as const;
export type CouncilPlan = (typeof COUNCIL_PLANS)[number];

export const CONSULTATION_MODES = ["INDIVIDUAL", "MULTI_EXECUTIVE", "FULL_COUNCIL", "CEO_RECOMMENDATION"] as const;
export type ConsultationMode = (typeof CONSULTATION_MODES)[number];

export interface CouncilLimits {
  maxConcurrent: number;
  maxDocuments: number;
  maxDocumentBytes: number;
  maxDurationSeconds: number;
  maxReportChars: number;
  modes: readonly ConsultationMode[];
}
const MB = 1024 * 1024;
const ALL = CONSULTATION_MODES;

/** Access tiers, not prices. */
export const PLAN_LIMITS: Record<Exclude<CouncilPlan, "DISABLED">, CouncilLimits> = {
  TRIAL: { maxConcurrent: 1, maxDocuments: 3, maxDocumentBytes: 5 * MB, maxDurationSeconds: 600, maxReportChars: 60_000, modes: ["INDIVIDUAL", "MULTI_EXECUTIVE", "CEO_RECOMMENDATION"] },
  STANDARD: { maxConcurrent: 2, maxDocuments: 10, maxDocumentBytes: 15 * MB, maxDurationSeconds: 900, maxReportChars: 120_000, modes: ALL },
  ENTERPRISE: { maxConcurrent: 5, maxDocuments: 30, maxDocumentBytes: 30 * MB, maxDurationSeconds: 1200, maxReportChars: 250_000, modes: ALL },
};

export type CouncilAccess =
  | { allowed: true; plan: Exclude<CouncilPlan, "DISABLED">; limits: CouncilLimits }
  | { allowed: false; reason: "disabled" | "trial_expired" };

export function councilAccess(
  org: { plan: CouncilPlan; trialEndsAt?: Date | null; maxConcurrentOverride?: number | null },
  now: Date = new Date(),
): CouncilAccess {
  if (org.plan === "DISABLED") return { allowed: false, reason: "disabled" };
  if (org.plan === "TRIAL" && (!org.trialEndsAt || org.trialEndsAt.getTime() <= now.getTime()))
    return { allowed: false, reason: "trial_expired" };
  const base = PLAN_LIMITS[org.plan];
  const override = org.maxConcurrentOverride;
  return { allowed: true, plan: org.plan, limits: override && override > 0 ? { ...base, maxConcurrent: override } : base };
}
