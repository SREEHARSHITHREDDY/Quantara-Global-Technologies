import type { MarketStatisticContent, SourceContent } from "./types";

// Every external figure is attributed to its source and must NEVER be presented
// as a Quantara result. Statements paraphrase the cited source.
// Claims from the corporate profile that we could not trace are kept with
// sourceKey = null and stay UNPUBLISHED until a source is attached in the CMS.

export const sources: SourceContent[] = [
  { key: "gartner-agents-2025", title: "Gartner Predicts 40% of Enterprise Apps Will Feature Task-Specific AI Agents by 2026, Up from Less Than 5% in 2025",
    publisher: "Gartner", kind: "PRESS_RELEASE", publishedAt: "2025-08-26", accessedAt: "2026-11-18",
    url: "https://www.gartner.com/en/newsroom/press-releases/2025-08-26-gartner-predicts-40-percent-of-enterprise-apps-will-feature-task-specific-ai-agents-by-2026-up-from-less-than-5-percent-in-2025",
    notes: "Release updated 2025-09-05 per Gartner." },
  { key: "nasscom-zinnov-fy26", title: "Zinnov-Nasscom India GCC Landscape Report FY26 (as reported by Business Today)",
    publisher: "Business Today (reporting Nasscom–Zinnov)", kind: "NEWS", publishedAt: "2026-05-07", accessedAt: "2026-11-18",
    url: "https://www.businesstoday.in/technology/news/story/the-big-boom-how-indias-gcc-story-hits-2030-target-4-years-early-530265-2026-05-07",
    notes: "Secondary coverage. The report's own release date was not confirmed; replace with the Nasscom/Zinnov primary release when available." },
  { key: "gartner-power-2024", title: "Gartner Predicts Power Shortages Will Restrict 40% of AI Data Centers By 2027",
    publisher: "Gartner", kind: "PRESS_RELEASE", publishedAt: "2024-11-12", accessedAt: "2026-11-18",
    url: "https://www.gartner.com/en/newsroom/press-releases/2024-11-12-gartner-predicts-power-shortages-will-restrict-40-percent-of-ai-data-centers-by-20270",
    notes: "URL as returned by search (ends in '20270'); confirm the link resolves before publishing." },
  { key: "mckinsey-qtm-2026", title: "McKinsey Quantum Technology Monitor 2026: A commercial tipping point",
    publisher: "McKinsey & Company", kind: "ANALYST_REPORT", publishedAt: "2026-04-28", accessedAt: "2026-11-18",
    url: "https://www.mckinsey.com/capabilities/mckinsey-technology/our-insights/mckinsey-quantum-technology-monitor-2026-a-commercial-tipping-point",
    notes: "Date as shown on the page; some coverage cites 2026-04-20. Verify." },
  { key: "iqm-state-of-quantum-2026", title: "State of Quantum 2026 (IQM; research by The Quantum Insider)",
    publisher: "IQM Quantum Computers / The Quantum Insider", kind: "INDUSTRY_BODY", publishedAt: "2026-06-18", accessedAt: "2026-11-18",
    url: "https://thequantuminsider.com/2026/06/18/new-industry-study-finds-quantum-computing-has-entered-a-capability-era-with-early-movers-building-an-advantage-later-entrants-will-struggle-to-close/",
    notes: "Published by a quantum-hardware vendor; survey of 107 senior practitioners. Treat as vendor-sponsored." },
];

export const marketStatistics: MarketStatisticContent[] = [
  { key: "agents-in-enterprise-apps", theme: "agentic-ai", sourceKey: "gartner-agents-2025", asOf: "2026-12-31",
    statement: "Gartner predicts that up to 40% of enterprise applications will include task-specific AI agents by 2026, up from less than 5% in 2025." },
  { key: "india-gcc-landscape-fy26", theme: "gcc", sourceKey: "nasscom-zinnov-fy26", asOf: "2026-03-31",
    statement: "According to the Zinnov–Nasscom India GCC Landscape Report FY26, India hosts 2,117 GCCs employing about 2.36 million professionals and generating roughly $98.4 billion in revenue." },
  { key: "ai-datacenter-power-2027", theme: "datacenter", sourceKey: "gartner-power-2024", asOf: "2027-12-31",
    statement: "Gartner predicts that 40% of existing AI data centers will be operationally constrained by power availability by 2027." },
  { key: "quantum-hybrid-path", theme: "quantum", sourceKey: "mckinsey-qtm-2026", asOf: "2026-04-28",
    statement: "McKinsey's Quantum Technology Monitor 2026 describes hybrid quantum-classical approaches as the most credible near-term path, with early experimentation in financial services, life sciences and logistics." },
  { key: "quantum-adoption-gap", theme: "quantum", sourceKey: "iqm-state-of-quantum-2026", asOf: "2026-06-18",
    statement: "An IQM-published survey of 107 senior practitioners found 89% report hands-on quantum work but only 13% report any production use." },

  // Claims present in the corporate profile with no verified source yet. UNPUBLISHED.
  { key: "pending-new-gccs-ai-mandate", theme: "gcc", sourceKey: null,
    statement: "Profile claim (unsourced): most new centers launched in 2026 are built with AI and machine learning as a core mandate." },
  { key: "pending-hyderabad-gcc-hub", theme: "gcc", sourceKey: null,
    statement: "Profile claim (unsourced): Hyderabad is a leading GCC hub, particularly for life sciences, analytics and data engineering." },
  { key: "pending-tier2-gcc-share", theme: "gcc", sourceKey: null,
    statement: "Profile claim (unsourced): Tier-II cities are gaining share of new GCCs." },
  { key: "pending-power-not-gpu-bottleneck", theme: "datacenter", sourceKey: null,
    statement: "Profile claim (unsourced): power availability, not GPU supply, is the leading bottleneck for new AI capacity." },
  { key: "pending-liquid-cooling-baseline", theme: "datacenter", sourceKey: null,
    statement: "Profile claim (unsourced): liquid cooling has become a baseline requirement for AI datacenters." },
  { key: "pending-quantum-cloud-access", theme: "quantum", sourceKey: null,
    statement: "Profile claim (unsourced): cloud providers are expanding pay-as-you-go quantum access." },
  { key: "pending-pqc-board-priority", theme: "quantum", sourceKey: null,
    statement: "Profile claim (unsourced): quantum-safe cryptography is becoming a board-level priority." },
  { key: "pending-agentic-governance-risk", theme: "agentic-ai", sourceKey: null,
    statement: "Profile claim (unsourced): a large share of agentic AI initiatives risk stalling without strong oversight and governance." },
];
