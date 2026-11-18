/** Neutral provider port. Nothing in the council depends on a vendor SDK. */
export const PROVIDER_IDS = ["anthropic", "openai", "mock"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export interface CompletionRequest {
  agentCode: string;
  system: string;
  prompt: string;
  maxOutputTokens: number;
  signal?: AbortSignal;
}
export interface Usage { inputTokens: number; outputTokens: number }
export interface CompletionResult { text: string; usage: Usage; model: string }

export interface LlmProvider {
  readonly id: ProviderId;
  /** True when output is not produced by a real model. Drives the SIMULATED label. */
  readonly simulated: boolean;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

export type ProviderErrorCode =
  | "timeout" | "rate_limited" | "auth" | "invalid_request" | "unavailable" | "cancelled";

export class ProviderError extends Error {
  constructor(readonly code: ProviderErrorCode, message: string, readonly retryable = false) {
    super(message);
    this.name = "ProviderError";
  }
}
