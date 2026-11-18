import { industries, services, type IndustryContent, type ServiceContent } from "@quantara/content";

export const getService = (slug: string): ServiceContent | undefined => services.find((s) => s.slug === slug);
export const getIndustry = (slug: string): IndustryContent | undefined => industries.find((i) => i.slug === slug);

/** Like getService but for slugs that are guaranteed by the content package; fails loudly if they are not. */
export function requireService(slug: string): ServiceContent {
  const s = getService(slug);
  if (!s) throw new Error(`Unknown service slug: ${slug}`);
  return s;
}
