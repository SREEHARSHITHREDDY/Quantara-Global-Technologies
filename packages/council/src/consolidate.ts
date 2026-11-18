import type { Assessment, Claim, Disagreement } from "./schema";
import { claimLabel, type ClaimLabel } from "./labels";

/** A disagreement is recorded, never merged into a fake consensus. */
export function detectDisagreements(assessments: Assessment[]): Disagreement[] {
  const support = assessments.filter((a) => a.stance === "support");
  const oppose = assessments.filter((a) => a.stance === "oppose");
  if (support.length === 0 || oppose.length === 0) return [];
  const position = (a: Assessment) => ({
    agent: a.agent, recommendation: a.recommendation,
    evidence: a.claims.map((c) => c.claim), assumptions: a.assumptions,
  });
  const consequences = [...support, ...oppose].flatMap((a) => a.risks.filter((r) => r.severity !== "low").map((r) => `${a.agent}: ${r.description}`)).slice(0, 6);
  return [{ topic: "Whether to proceed", positions: [...support, ...oppose].map(position), consequences, resolved: false }];
}

export interface ConsolidatedResult {
  simulated: boolean;
  label: "SIMULATED ANALYSIS" | "AI-GENERATED ANALYSIS";
  /** False whenever executives disagree or an assessor failed. */
  consensus: boolean;
  headline: string;
  overallConfidence: number;
  agents: { agent: string; stance: Assessment["stance"]; recommendation: string; confidence: number }[];
  disagreements: Disagreement[];
  missingInformation: { agent: string; item: string }[];
  assumptions: { agent: string; item: string }[];
  risks: { agent: string; description: string; severity: "low" | "medium" | "high" }[];
  approvalsRequired: { agent: string; action: string; reason: string }[];
  claims: (Claim & { label: ClaimLabel })[];
  failedAgents: { agent: string; reason: string }[];
  skippedAgents: { agent: string; reason: string }[];
  caveats: string[];
}

const SEV = { high: 0, medium: 1, low: 2 } as const;

export function consolidate(a: {
  assessments: Assessment[]; disagreements: Disagreement[]; simulated: boolean;
  failed: { agent: string; reason: string }[]; skipped: { agent: string; reason: string }[];
}): ConsolidatedResult {
  const { assessments, disagreements, simulated, failed, skipped } = a;
  const ceo = assessments.find((x) => x.agent === "CEO");
  const consensus = disagreements.length === 0 && failed.length === 0 && skipped.length === 0;
  const attempted = assessments.length + failed.length + skipped.length;
  const mean = assessments.length ? assessments.reduce((s, x) => s + x.confidence, 0) / assessments.length : 0;
  const overallConfidence = Math.round(mean * (attempted ? assessments.length / attempted : 0) * 100) / 100;
  const caveats: string[] = [];
  if (simulated) caveats.push("Simulated output from the Mock provider. It is not real analysis.");
  if (disagreements.length) caveats.push("Executives disagree. Both positions are shown; no consensus was forced.");
  if (failed.length) caveats.push(`${failed.length} assessment(s) failed: ${failed.map((f) => f.agent).join(", ")}.`);
  if (skipped.length) caveats.push(`${skipped.length} assessment(s) were skipped: ${skipped.map((f) => f.agent).join(", ")}.`);
  if (assessments.some((x) => x.missingInformation.length)) caveats.push("Information was missing; confidence is lower.");
  const flat = <T>(f: (x: Assessment) => T[]) => assessments.flatMap((x) => f(x));
  return {
    simulated,
    label: simulated ? "SIMULATED ANALYSIS" : "AI-GENERATED ANALYSIS",
    consensus,
    headline: ceo ? ceo.recommendation : assessments.length ? "No lead recommendation: the CEO assessment is not available." : "No assessments completed.",
    overallConfidence,
    agents: assessments.map((x) => ({ agent: x.agent, stance: x.stance, recommendation: x.recommendation, confidence: x.confidence })),
    disagreements,
    missingInformation: flat((x) => x.missingInformation.map((item) => ({ agent: x.agent, item }))),
    assumptions: flat((x) => x.assumptions.map((item) => ({ agent: x.agent, item }))),
    risks: flat((x) => x.risks.map((r) => ({ agent: x.agent, ...r }))).sort((p, q) => SEV[p.severity] - SEV[q.severity]),
    approvalsRequired: flat((x) => x.approvalsRequired.map((r) => ({ agent: x.agent, ...r }))),
    claims: flat((x) => x.claims).map((c) => ({ ...c, label: claimLabel(c, simulated) })),
    failedAgents: failed, skippedAgents: skipped, caveats,
  };
}
