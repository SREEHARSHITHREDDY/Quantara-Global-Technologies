import type { ProviderId } from "./providers/port";

export interface ProviderPolicy {
  platformEnabled: ProviderId[];      // ordered; first is the platform default
  organizationAllowed?: ProviderId[] | null; // null/undefined = no restriction
  organizationPreferred?: ProviderId | null;
  requested?: ProviderId | null;      // per-consultation choice
}
export type ProviderDecision =
  | { ok: true; provider: ProviderId; source: "consultation" | "organization" | "platform" }
  | { ok: false; reason: "no_provider_available" | "requested_not_allowed" };

/** Each level may only narrow the one above it. */
export function resolveProvider(p: ProviderPolicy): ProviderDecision {
  const allowed = p.platformEnabled.filter((id) => !p.organizationAllowed || p.organizationAllowed.includes(id));
  if (allowed.length === 0) return { ok: false, reason: "no_provider_available" };
  if (p.requested) {
    return allowed.includes(p.requested)
      ? { ok: true, provider: p.requested, source: "consultation" }
      : { ok: false, reason: "requested_not_allowed" };
  }
  if (p.organizationPreferred && allowed.includes(p.organizationPreferred))
    return { ok: true, provider: p.organizationPreferred, source: "organization" };
  return { ok: true, provider: allowed[0]!, source: "platform" };
}
