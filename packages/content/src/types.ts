export interface ServiceContent {
  slug: string;
  /** Exact service-category name from the corporate profile. */
  title: string;
  summary: string;
  introduction: string;
  overview: string;
  /** Capabilities, verbatim from the corporate profile. */
  capabilities: string[];
  /** Generic, non-claim wording. Editorial; admin-editable in the CMS. */
  businessChallenges: string[];
  /** Typical application scenarios. NOT descriptions of past client work. */
  enterpriseApplications: string[];
  relatedServiceSlugs: string[];
  relatedIndustrySlugs: string[];
}
export interface IndustryContent {
  slug: string;
  title: string;
  summary: string;
  introduction: string;
  /** General industry challenges (editorial, not Quantara results). */
  challenges: string[];
  relatedServiceSlugs: string[];
}
export interface SourceContent {
  key: string;
  title: string;
  publisher: string;
  url: string;
  kind: "ANALYST_REPORT" | "PRESS_RELEASE" | "GOVERNMENT" | "INDUSTRY_BODY" | "NEWS" | "OTHER";
  /** ISO date (YYYY-MM-DD) the source was published. Mandatory. */
  publishedAt: string;
  /** ISO date this source was last checked by us. */
  accessedAt: string;
  notes?: string;
}
export interface MarketStatisticContent {
  key: string;
  theme: "agentic-ai" | "quantum" | "gcc" | "datacenter";
  /** Attributed to the source, never to Quantara. */
  statement: string;
  /** Key into sources; null = claim appears in the profile but has no verified source yet. */
  sourceKey: string | null;
  asOf?: string;
}
