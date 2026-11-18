import { type CompletionRequest, type CompletionResult, type LlmProvider, ProviderError } from "./port";
import type { Assessment } from "../schema";

export const MOCK_SCENARIOS = [
  "success", "disagreement", "missing_information", "budget_exhaustion", "agent_failure",
  "invalid_response", "approval_required", "partial_execution", "cancellation", "timeout",
] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

const FAILING_PARTIAL = new Set(["CFO", "CMO"]);

function base(agent: string): Assessment {
  return {
    agent, stance: "conditional",
    summary: `[simulated] ${agent} reviewed the proposal.`,
    recommendation: `[simulated] Proceed in phases; ${agent} review at each gate.`,
    confidence: 0.7,
    claims: [{ claim: `[simulated] ${agent} claim based on the information provided.`, classification: "user_provided", confidence: 0.7, agent }],
    assumptions: ["[simulated] Figures supplied by the user are accurate."],
    risks: [{ description: "[simulated] Execution risk.", severity: "medium" }],
    missingInformation: [], approvalsRequired: [],
  };
}

/** Deterministic stand-in for a real model. Produces no real analysis. */
export class MockProvider implements LlmProvider {
  readonly id = "mock" as const;
  readonly simulated = true;
  constructor(private readonly scenario: MockScenario = "success") {}

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const a = req.agentCode;
    const s = this.scenario;
    if (req.signal?.aborted || s === "cancellation") throw new ProviderError("cancelled", "cancelled");
    if (s === "timeout") throw new ProviderError("timeout", "provider timed out", true);
    if (s === "agent_failure" && a === "CFO") throw new ProviderError("unavailable", "provider unavailable", true);
    if (s === "partial_execution" && FAILING_PARTIAL.has(a)) throw new ProviderError("unavailable", "provider unavailable", true);

    let out: Assessment = base(a);
    let inputTokens = 800, outputTokens = 400;
    if (s === "invalid_response") return { text: "Sorry, here is my analysis in prose, not JSON.", usage: { inputTokens, outputTokens }, model: "mock-1" };
    if (s === "budget_exhaustion") { inputTokens = 5_000_000; outputTokens = 1_000_000; }
    if (s === "disagreement") {
      if (a === "CFO") out = { ...out, stance: "oppose", recommendation: "[simulated] Do not proceed: cash runway is too short.", assumptions: ["[simulated] Revenue starts after month 9."], confidence: 0.8 };
      if (a === "CTO" || a === "CSO") out = { ...out, stance: "support", recommendation: "[simulated] Proceed now: delay costs the market window.", assumptions: ["[simulated] Competitors launch within 6 months."], confidence: 0.75 };
    }
    if (s === "missing_information") out = { ...out, confidence: 0.35, missingInformation: ["[simulated] Budget not provided.", "[simulated] Timeline not provided."] };
    if (s === "approval_required") out = { ...out, approvalsRequired: [{ action: "[simulated] Sign vendor contract", reason: "Commits funds; needs a human decision." }] };
    return { text: JSON.stringify(out), usage: { inputTokens, outputTokens }, model: "mock-1" };
  }
}
