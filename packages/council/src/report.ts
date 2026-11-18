import { z } from "zod";
import type { ConsolidatedResult } from "./consolidate";
import { disagreementSchema } from "./schema";

/** Validates the stored consolidation before it is trusted for rendering or export. */
const claimOut = z.object({
  claim: z.string(), classification: z.string(), source: z.string().optional(), verifiedAt: z.string().optional(),
  confidence: z.number(), agent: z.string(), label: z.enum(["SOURCE VERIFIED", "USER PROVIDED", "EXTERNAL RESEARCH, UNVERIFIED", "ASSUMPTION"]),
});
const consolidatedSchema = z.object({
  simulated: z.boolean(), label: z.enum(["SIMULATED ANALYSIS", "AI-GENERATED ANALYSIS"]), consensus: z.boolean(),
  headline: z.string(), overallConfidence: z.number(),
  agents: z.array(z.object({ agent: z.string(), stance: z.enum(["support", "oppose", "conditional", "abstain"]), recommendation: z.string(), confidence: z.number() })),
  disagreements: z.array(disagreementSchema),
  missingInformation: z.array(z.object({ agent: z.string(), item: z.string() })),
  assumptions: z.array(z.object({ agent: z.string(), item: z.string() })),
  risks: z.array(z.object({ agent: z.string(), description: z.string(), severity: z.enum(["low", "medium", "high"]) })),
  approvalsRequired: z.array(z.object({ agent: z.string(), action: z.string(), reason: z.string() })),
  claims: z.array(claimOut),
  failedAgents: z.array(z.object({ agent: z.string(), reason: z.string() })),
  skippedAgents: z.array(z.object({ agent: z.string(), reason: z.string() })),
  caveats: z.array(z.string()),
});
export function parseConsolidated(v: unknown): ConsolidatedResult | null {
  const r = consolidatedSchema.safeParse(v);
  return r.success ? (r.data as ConsolidatedResult) : null;
}

export interface ReportMeta { prompt: string; mode: string; participants: string[]; templateId: string | null; createdAt: string }
export interface ReportSection { n: number; title: string; covered: boolean; paragraphs: string[]; bullets: string[] }
export interface Report { title: string; label: ConsolidatedResult["label"]; simulated: boolean; meta: ReportMeta; sections: ReportSection[] }

const NOT_ASSESSED = "Not assessed: no selected executive covers this area. Nothing has been inferred for it.";
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Which executives speak to which section. Sections with no owner are filled from the consolidation or marked not assessed. */
const DEPARTMENT: { n: number; title: string; agents: string[] }[] = [
  { n: 5, title: "Financial projections and assumptions", agents: ["CFO"] },
  { n: 6, title: "Technical feasibility", agents: ["CTO"] },
  { n: 7, title: "Operational feasibility", agents: ["COO"] },
  { n: 8, title: "Workforce requirements", agents: ["CHRO"] },
  { n: 9, title: "Market and revenue opportunities", agents: ["CMO", "CRO"] },
  { n: 10, title: "Legal and regulatory considerations", agents: ["CLO"] },
  { n: 11, title: "Security risks", agents: ["CISO"] },
  { n: 12, title: "Sustainability considerations", agents: [] },
];

/**
 * Builds the 20-section executive report from the consolidated result only. It never adds facts:
 * where the analysis has nothing for a section, the section says so.
 */
export function buildReport(r: ConsolidatedResult, meta: ReportMeta): Report {
  const sec = (n: number, title: string, paragraphs: string[], bullets: string[] = []): ReportSection => ({ n, title, covered: paragraphs.length + bullets.length > 0, paragraphs, bullets });
  const empty = (n: number, title: string, note = NOT_ASSESSED): ReportSection => ({ n, title, covered: false, paragraphs: [note], bullets: [] });
  const by = (code: string) => r.agents.find((a) => a.agent === code);
  const said = (codes: string[]) => r.agents.filter((a) => codes.includes(a.agent));
  const claimsOf = (codes: string[]) => r.claims.filter((c) => codes.includes(c.agent)).map((c) => `${c.claim} [${c.label}${c.source ? `; source: ${c.source}` : ""}]`);
  const assumptionsOf = (codes: string[]) => r.assumptions.filter((a) => codes.includes(a.agent)).map((a) => `Assumption: ${a.item}`);
  const risksOf = (codes: string[]) => r.risks.filter((x) => codes.includes(x.agent)).map((x) => `Risk (${x.severity}): ${x.description}`);

  const out: ReportSection[] = [];
  out.push(sec(1, "Executive summary", [r.headline, r.consensus ? "The assessing executives are in agreement." : "The executives did not reach consensus. See sections 13 and 14."]));
  out.push(sec(2, "Problem understanding", [meta.prompt], [`Consultation mode: ${meta.mode.replace(/_/g, " ").toLowerCase()}`, ...(meta.templateId ? [`Template: ${meta.templateId}`] : []), `Executives consulted: ${meta.participants.join(", ")}`]));
  const ceo = by("CEO");
  out.push(ceo ? sec(3, "CEO strategic assessment", [ceo.recommendation, `Stance: ${ceo.stance}. Confidence: ${pct(ceo.confidence)}.`]) : empty(3, "CEO strategic assessment", "The CEO assessment is not available for this consultation."));
  out.push(sec(4, "Individual departmental assessments", [], r.agents.map((a) => `${a.agent} (${a.stance}, confidence ${pct(a.confidence)}): ${a.recommendation}`)));
  for (const d of DEPARTMENT) {
    const heard = said(d.agents);
    if (!heard.length) { out.push(empty(d.n, d.title)); continue; }
    out.push(sec(d.n, d.title, heard.map((a) => `${a.agent}: ${a.recommendation}`), [...claimsOf(d.agents), ...assumptionsOf(d.agents), ...risksOf(d.agents)]));
  }
  out.push(r.disagreements.length
    ? sec(13, "Identified disagreements", [], r.disagreements.flatMap((d) => [`${d.topic}${d.resolved ? " (resolved)" : " (unresolved)"}`, ...d.positions.map((p) => `   ${p.agent}: ${p.recommendation}`)]))
    : sec(13, "Identified disagreements", ["No disagreements were detected among the assessing executives."]));
  out.push(r.risks.length ? sec(14, "Critical risks", [], r.risks.map((x) => `${x.severity.toUpperCase()} (${x.agent}): ${x.description}`)) : sec(14, "Critical risks", ["No risks were raised."]));
  out.push(sec(15, "Recommended action plan", ["Each item is an executive's recommendation, in the order given. It is advice for a human to review, not an executed action."], r.agents.map((a) => `${a.agent}: ${a.recommendation}`)));
  out.push(empty(16, "Implementation roadmap", "No phased timeline was produced by this analysis. Where approvals are listed in section 20, they are the gates before any step is taken."));
  out.push(sec(17, "Final AI-generated recommendation", [r.headline, `This is ${r.label.toLowerCase()}, advisory only.`]));
  out.push(sec(18, "Confidence level", [`Overall confidence: ${pct(r.overallConfidence)}. It is lowered when assessments fail, are skipped or lack information.`], r.agents.map((a) => `${a.agent}: ${pct(a.confidence)}`)));
  out.push(r.missingInformation.length ? sec(19, "Missing information", [], r.missingInformation.map((m) => `${m.agent}: ${m.item}`)) : sec(19, "Missing information", ["No missing information was reported."]));
  out.push(r.approvalsRequired.length ? sec(20, "Human decisions required", ["No action below is taken automatically. Each needs a person with approval authority."], r.approvalsRequired.map((a) => `${a.agent}: ${a.action}. Reason: ${a.reason}`)) : sec(20, "Human decisions required", ["No human approvals were requested."]));
  return { title: "Executive Council Report", label: r.label, simulated: r.simulated, meta, sections: out.sort((a, b) => a.n - b.n) };
}

export const EVIDENCE_LEGEND = "Evidence labels: SOURCE VERIFIED (a source and verification date are recorded), USER PROVIDED, EXTERNAL RESEARCH, UNVERIFIED, ASSUMPTION.";

export function reportToMarkdown(rep: Report, r?: Pick<ConsolidatedResult, "caveats" | "failedAgents" | "skippedAgents">): string {
  const lines: string[] = [`# ${rep.title}`, "", `**${rep.label}**${rep.simulated ? " (test output, not real analysis)" : ""}`, "", `Created: ${rep.meta.createdAt}`, "", `_${EVIDENCE_LEGEND}_`, ""];
  for (const s of rep.sections) {
    lines.push(`## ${s.n}. ${s.title}`, "");
    for (const p of s.paragraphs) lines.push(p, "");
    for (const b of s.bullets) lines.push(`- ${b.trimStart()}`);
    if (s.bullets.length) lines.push("");
  }
  if (r?.caveats.length) lines.push("## Caveats", "", ...r.caveats.map((c) => `- ${c}`), "");
  lines.push("---", "", "This report supports a decision. It is not legal, financial or other professional advice.");
  return lines.join("\n");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Print-ready HTML (use the browser's Print to save as PDF). All text is escaped. */
export function reportToHtml(rep: Report, r?: Pick<ConsolidatedResult, "caveats">): string {
  const body = rep.sections.map((s) => `<h2>${s.n}. ${esc(s.title)}</h2>${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}${s.bullets.length ? `<ul>${s.bullets.map((b) => `<li>${esc(b.trimStart())}</li>`).join("")}</ul>` : ""}`).join("");
  const cav = r?.caveats.length ? `<h2>Caveats</h2><ul>${r.caveats.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(rep.title)}</title><style>body{font:15px/1.55 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#111}h1{font-size:1.6rem}h2{font-size:1.1rem;margin-top:1.6rem}.banner{border:1px solid #999;padding:.5rem .75rem;font-weight:600}small{color:#555}</style></head><body><h1>${esc(rep.title)}</h1><p class="banner">${esc(rep.label)}${rep.simulated ? " (test output, not real analysis)" : ""}</p><p><small>Created ${esc(rep.meta.createdAt)}. ${esc(EVIDENCE_LEGEND)}</small></p>${body}${cav}<hr><p><small>This report supports a decision. It is not legal, financial or other professional advice.</small></p></body></html>`;
}
