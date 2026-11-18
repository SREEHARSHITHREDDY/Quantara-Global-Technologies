import type { Claim } from "./schema";
import type { LlmProvider } from "./providers/port";

export type AnalysisLabel = "SIMULATED ANALYSIS" | "AI-GENERATED ANALYSIS";
export type ClaimLabel = "SOURCE VERIFIED" | "USER PROVIDED" | "EXTERNAL RESEARCH, UNVERIFIED" | "ASSUMPTION";

export function analysisLabel(p: Pick<LlmProvider, "simulated">): AnalysisLabel {
  return p.simulated ? "SIMULATED ANALYSIS" : "AI-GENERATED ANALYSIS";
}

/** "SOURCE VERIFIED" needs classification verified AND a source AND a verification date. A model saying "verified" is not enough. */
export function claimLabel(c: Claim, simulated: boolean): ClaimLabel {
  if (c.classification === "verified" && !simulated && c.source && c.verifiedAt) return "SOURCE VERIFIED";
  if (c.classification === "user_provided") return "USER PROVIDED";
  if (c.classification === "assumption") return "ASSUMPTION";
  return "EXTERNAL RESEARCH, UNVERIFIED";
}
