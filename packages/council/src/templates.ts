import type { AgentCode } from "./agents/definitions";

export interface ConsultationTemplate {
  id: string; name: string; summary: string;
  /** The CEO always orchestrates; these are the assessing executives. */
  participants: AgentCode[];
  inputs: string[];
}

export const TEMPLATES: ConsultationTemplate[] = [
  { id: "business-expansion", name: "Business Expansion", summary: "Whether and how to expand into a new region, segment or line.", participants: ["CEO", "CFO", "COO", "CLO", "CSO"], inputs: ["Target market", "Investment range", "Timeline", "Current capacity"] },
  { id: "startup-feasibility", name: "Startup Feasibility", summary: "Whether a new venture is viable.", participants: ["CEO", "CFO", "CTO", "CMO", "CRO"], inputs: ["Problem and customer", "Product scope", "Funding available", "Team"] },
  { id: "gcc-establishment", name: "GCC Establishment", summary: "Setting up a global capability centre.", participants: ["CEO", "CFO", "CTO", "COO", "CHRO", "CLO"], inputs: ["Location options", "Headcount plan", "Functions in scope", "Budget"] },
  { id: "digital-transformation", name: "Digital Transformation", summary: "Modernizing systems and ways of working.", participants: ["CEO", "CTO", "COO", "CISO"], inputs: ["Current systems", "Goals", "Constraints", "Timeline"] },
  { id: "financial-risk", name: "Financial Risk Assessment", summary: "Exposure, controls and legal implications of a financial risk.", participants: ["CEO", "CFO", "CLO"], inputs: ["Risk description", "Exposure size", "Existing controls"] },
  { id: "cybersecurity-assessment", name: "Cybersecurity Assessment", summary: "Security posture, gaps and operational impact.", participants: ["CTO", "CISO", "COO"], inputs: ["Systems in scope", "Known incidents", "Compliance needs"] },
  { id: "workforce-planning", name: "Workforce Planning", summary: "Hiring, skills and cost of a workforce plan.", participants: ["CEO", "CHRO", "CFO", "COO"], inputs: ["Current headcount", "Growth plan", "Skill gaps", "Budget"] },
  { id: "market-entry", name: "Market Entry Strategy", summary: "Entering a new market with positioning, pricing and compliance.", participants: ["CEO", "CMO", "CRO", "CFO", "CLO"], inputs: ["Target market", "Offer", "Competitors", "Pricing idea"] },
];

export function getTemplate(id: string): ConsultationTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
