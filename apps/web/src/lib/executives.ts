import { AGENTS, type AgentDefinition } from "@quantara/council";

/** Public presentation of the ten council executives. Mandates, focus areas and questions come from the council package, so this page can never drift from what the agents actually do. */
export interface ExecutiveGroup { id: string; title: string; summary: string; codes: string[] }

export const EXECUTIVE_GROUPS: ExecutiveGroup[] = [
  { id: "leadership", title: "Leadership and strategy", summary: "Frame the decision, weigh the views and see the longer-term options.", codes: ["CEO", "CSO"] },
  { id: "growth", title: "Finance and growth", summary: "Cost, return, demand and revenue.", codes: ["CFO", "CRO", "CMO"] },
  { id: "technology", title: "Technology and security", summary: "What can be built, how it scales and how it is protected.", codes: ["CTO", "CISO"] },
  { id: "people", title: "Operations, people and legal", summary: "Whether the organization can deliver it, staff it and stay compliant.", codes: ["COO", "CHRO", "CLO"] },
];

const TAGLINES: Record<string, string> = {
  CEO: "One question, every perspective, one considered answer.",
  CFO: "Know the cost before you commit.",
  CTO: "Know what can be built, and what it will take.",
  COO: "Turn the decision into delivery.",
  CMO: "See the market through your customer's eyes.",
  CRO: "Find where the revenue really comes from.",
  CHRO: "Check you have the people before you plan.",
  CLO: "Spot the legal exposure early.",
  CISO: "Find the security gaps before others do.",
  CSO: "See the options, the competition and the timing.",
};

export interface Executive extends AgentDefinition { slug: string; tagline: string; group: ExecutiveGroup }

export const EXECUTIVES: Executive[] = AGENTS.map((a) => {
  const group = EXECUTIVE_GROUPS.find((g) => g.codes.includes(a.code));
  if (!group) throw new Error(`Executive ${a.code} is not in a group`);
  return { ...a, slug: a.code.toLowerCase(), tagline: TAGLINES[a.code] ?? "", group };
});

export const getExecutive = (slug: string) => EXECUTIVES.find((e) => e.slug === slug);

/** What every assessment contains. True of the current build, whichever provider runs it. */
export const WHAT_YOU_RECEIVE = [
  "A clear stance: support, oppose, conditional or abstain",
  "A recommendation and a confidence level",
  "Claims labelled by evidence: source verified, user provided, external research or assumption",
  "Risks, assumptions and the information that is missing",
  "Any action that needs a human decision before anyone proceeds",
];

export const PREVIEW_NOTICE = "Preview: until a live AI provider is connected, executive assessments are simulated test output and are labelled SIMULATED ANALYSIS. All output is advisory.";
