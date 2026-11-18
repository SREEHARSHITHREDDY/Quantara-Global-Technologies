import { AGENT_CODES, type AgentCode } from "./agents/definitions";
import type { ConsultationMode } from "./access";
import { getTemplate } from "./templates";

/** Used by "CEO recommendation" when the user names no executives. */
export const DEFAULT_CEO_RECOMMENDATION_SET: AgentCode[] = ["CEO", "CFO", "COO", "CSO"];

export type SelectionError = "unknown_template" | "unknown_agent" | "individual_needs_one_agent" | "multi_needs_two_agents";
export type Selection = { ok: true; participants: AgentCode[]; templateId?: string } | { ok: false; error: SelectionError };

const isCode = (c: string): c is AgentCode => (AGENT_CODES as readonly string[]).includes(c);
const canonical = (codes: Iterable<AgentCode>): AgentCode[] => { const s = new Set(codes); return AGENT_CODES.filter((c) => s.has(c)); };

/**
 * Decides who takes part. A template supplies a default list; an explicit list overrides it.
 * Full Council always means all ten. Selection is deterministic: no model call decides who is consulted.
 */
export function selectParticipants(input: { mode: ConsultationMode; participants?: string[]; templateId?: string }): Selection {
  let templateId: string | undefined, fromTemplate: AgentCode[] | undefined;
  if (input.templateId) {
    const t = getTemplate(input.templateId);
    if (!t) return { ok: false, error: "unknown_template" };
    templateId = t.id; fromTemplate = t.participants;
  }
  const chosen = input.participants ?? [];
  if (!chosen.every(isCode)) return { ok: false, error: "unknown_agent" };
  const explicit = chosen as AgentCode[];
  switch (input.mode) {
    case "FULL_COUNCIL": return { ok: true, participants: [...AGENT_CODES], templateId };
    case "INDIVIDUAL": {
      const one = canonical(explicit);
      return one.length === 1 ? { ok: true, participants: one } : { ok: false, error: "individual_needs_one_agent" };
    }
    case "MULTI_EXECUTIVE": {
      const list = canonical(explicit.length ? explicit : (fromTemplate ?? []));
      return list.length >= 2 ? { ok: true, participants: list, templateId } : { ok: false, error: "multi_needs_two_agents" };
    }
    case "CEO_RECOMMENDATION": {
      const base = explicit.length ? explicit : (fromTemplate ?? DEFAULT_CEO_RECOMMENDATION_SET);
      return { ok: true, participants: canonical([...base, "CEO"]), templateId };
    }
  }
}
