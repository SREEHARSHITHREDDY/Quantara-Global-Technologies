import { industries, services } from "@quantara/content";
import { EXECUTIVES } from "./executives";
import { LIVE_STATIC_ROUTES } from "./routes";

/** Pages that must never be listed for search engines: sign-in, account, the signed-in Council and private areas. */
const PRIVATE_PREFIXES = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/verify-email", "/two-factor", "/account", "/council", "/admin", "/staff", "/api", "/newsletter", "/design-system"];
export const isPrivatePath = (p: string) => PRIVATE_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`));

export const siteBase = () => (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Public, indexable paths known without a database. */
export function publicPaths(): string[] {
  const out = new Set<string>();
  for (const r of LIVE_STATIC_ROUTES) if (!isPrivatePath(r)) out.add(r);
  for (const s of services) out.add(`/services/${s.slug}`);
  for (const i of industries) out.add(`/industries/${i.slug}`);
  for (const e of EXECUTIVES) out.add(`/executives/${e.slug}`);
  return [...out].sort();
}
export const PRIVATE_DISALLOW = ["/admin", "/staff", "/api/", "/council", "/account", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/verify-email", "/two-factor", "/newsletter/"];
