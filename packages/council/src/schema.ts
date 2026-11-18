import { z } from "zod";

export const CLAIM_CLASSES = ["verified", "user_provided", "external_research", "assumption"] as const;
export type ClaimClass = (typeof CLAIM_CLASSES)[number];

export const claimSchema = z.object({
  claim: z.string().min(1).max(600),
  classification: z.enum(CLAIM_CLASSES),
  source: z.string().max(500).optional(),
  verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  confidence: z.number().min(0).max(1),
  agent: z.string().min(2).max(8),
});
export type Claim = z.infer<typeof claimSchema>;

export const assessmentSchema = z.object({
  agent: z.string().min(2).max(8),
  stance: z.enum(["support", "oppose", "conditional", "abstain"]),
  summary: z.string().min(1).max(2000),
  recommendation: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1),
  claims: z.array(claimSchema).max(25),
  assumptions: z.array(z.string().max(400)).max(20),
  risks: z.array(z.object({ description: z.string().max(400), severity: z.enum(["low", "medium", "high"]) })).max(20),
  missingInformation: z.array(z.string().max(400)).max(20),
  approvalsRequired: z.array(z.object({ action: z.string().max(300), reason: z.string().max(400) })).max(10),
});
export type Assessment = z.infer<typeof assessmentSchema>;

/** A disagreement is recorded, never forced into consensus. */
export const disagreementSchema = z.object({
  topic: z.string().max(300),
  positions: z.array(z.object({
    agent: z.string(), recommendation: z.string(), evidence: z.array(z.string()), assumptions: z.array(z.string()),
  })).min(2),
  consequences: z.array(z.string()),
  resolved: z.boolean(),
  resolution: z.string().optional(),
});
export type Disagreement = z.infer<typeof disagreementSchema>;

export type ParseResult = { ok: true; value: Assessment } | { ok: false; error: string };

/** Parse provider text into a validated assessment. Never throws. */
export function parseAssessment(text: string, expectedAgent: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return { ok: false, error: "response is not valid JSON" };
  }
  const r = assessmentSchema.safeParse(raw);
  if (!r.success) return { ok: false, error: r.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  if (r.data.agent !== expectedAgent) return { ok: false, error: `response is for ${r.data.agent}, expected ${expectedAgent}` };
  return { ok: true, value: r.data };
}
