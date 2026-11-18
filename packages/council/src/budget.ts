import type { Usage } from "./providers/port";

/** Used when an organization has no monthly budget of its own. Staff can set one per organization. */
export const DEFAULT_MONTHLY_BUDGET = { tokens: 2_000_000, costUsd: 50 } as const;

/** USD per million tokens. Real provider rates are configured by staff; the Mock provider is free. */
export interface Rate { inputPerMTokUsd: number; outputPerMTokUsd: number }
export const FREE_RATE: Rate = { inputPerMTokUsd: 0, outputPerMTokUsd: 0 };

export const priceUsd = (u: Usage, r: Rate): number =>
  Math.round(((u.inputTokens * r.inputPerMTokUsd + u.outputTokens * r.outputPerMTokUsd) / 1_000_000) * 1e6) / 1e6;

export const approxTokens = (chars: number): number => Math.ceil(chars / 4);

export const DEFAULT_MAX_OUTPUT_TOKENS = 1500;
const OVERHEAD_TOKENS = 1200; // system prompt and framing
const RETRY_ALLOWANCE = 1.5;  // one retry for some calls

/** Upper-bound estimate for one call. Used to reserve budget before the call is made. */
export function estimateCall(promptChars: number, maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS): Usage {
  return { inputTokens: approxTokens(promptChars) + OVERHEAD_TOKENS, outputTokens: maxOutputTokens };
}

/** Estimate for a whole consultation: one call per participant, plus the CEO reading the others' answers. */
export function estimateExecution(a: { participants: number; promptChars: number; maxOutputTokens?: number }, rate: Rate): { tokens: number; costUsd: number } {
  const out = a.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const one = estimateCall(a.promptChars, out);
  const synthesisExtra = a.participants > 1 ? a.participants * 700 : 0;
  const inputTokens = Math.ceil((one.inputTokens * a.participants + synthesisExtra) * RETRY_ALLOWANCE);
  const outputTokens = Math.ceil(out * a.participants * RETRY_ALLOWANCE);
  return { tokens: inputTokens + outputTokens, costUsd: priceUsd({ inputTokens, outputTokens }, rate) };
}
