import type { WorkspaceCouncilDefault } from "@quantara/db";

/**
 * The Council plan a NEW customer workspace starts on, from COUNCIL_DEFAULT_PLAN:
 *   unset or STANDARD → open to every new workspace (the live preview);  TRIAL → time-limited (COUNCIL_DEFAULT_TRIAL_DAYS, default 14);
 *   DISABLED → closed until staff enable it.
 * Anything unrecognised closes it: a typo can never open access by accident.
 */
export function councilDefaultFromEnv(env: Record<string, string | undefined> = process.env): WorkspaceCouncilDefault {
  const raw = env.COUNCIL_DEFAULT_PLAN?.trim().toUpperCase();
  if (!raw || raw === "STANDARD") return { councilPlan: "STANDARD" };
  if (raw === "TRIAL") {
    const n = Number.parseInt(env.COUNCIL_DEFAULT_TRIAL_DAYS ?? "", 10);
    return { councilPlan: "TRIAL", councilTrialDays: Number.isFinite(n) && n >= 1 && n <= 365 ? n : 14 };
  }
  return { councilPlan: "DISABLED" };
}
