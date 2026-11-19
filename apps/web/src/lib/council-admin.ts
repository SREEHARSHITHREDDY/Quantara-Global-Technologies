import { COUNCIL_PLANS } from "@quantara/council";

export type PlanInput = { plan: (typeof COUNCIL_PLANS)[number]; trialDays?: number; maxConcurrent: number | null };
export const TRIAL_DAYS_MAX = 90;
export const CONCURRENT_MAX = 10;

/** Validates the plan form. Errors are keyed by field name. */
export function validatePlanForm(f: { plan?: unknown; trialDays?: unknown; maxConcurrent?: unknown }): { ok: true; value: PlanInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const plan = COUNCIL_PLANS.find((p) => p === f.plan);
  if (!plan) errors.plan = "Choose a plan.";
  let trialDays: number | undefined;
  if (plan === "TRIAL") {
    const n = Number(String(f.trialDays ?? "").trim());
    if (!Number.isInteger(n) || n < 1 || n > TRIAL_DAYS_MAX) errors.trialDays = `Enter a whole number of days from 1 to ${TRIAL_DAYS_MAX}.`; else trialDays = n;
  }
  let maxConcurrent: number | null = null;
  const raw = String(f.maxConcurrent ?? "").trim();
  if (raw !== "") {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > CONCURRENT_MAX) errors.maxConcurrent = `Leave blank for the plan default, or enter 1 to ${CONCURRENT_MAX}.`; else maxConcurrent = n;
  }
  if (Object.keys(errors).length || !plan) return { ok: false, errors };
  return { ok: true, value: { plan, ...(trialDays ? { trialDays } : {}), maxConcurrent } };
}
