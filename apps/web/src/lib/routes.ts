import { industries, services } from "@quantara/content";

/**
 * Routes that have a real page. Navigation and calls to action only link to live routes, so the
 * site never ships dead links while it is built in stages. Add a route here in the same change
 * that adds its page. A unit test checks that every entry has a page file.
 */
export const LIVE_STATIC_ROUTES = ["/", "/about", "/services", "/industries", "/approach", "/contact", "/careers", "/insights", "/privacy-policy", "/terms", "/cookie-policy", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/two-factor", "/verify-email", "/account"] as const;

export function isLive(path: string): boolean {
  if ((LIVE_STATIC_ROUTES as readonly string[]).includes(path)) return true;
  const m = /^\/(services|industries)\/([^/]+)$/.exec(path);
  if (!m) return false;
  const list = m[1] === "services" ? services : industries;
  return list.some((x) => x.slug === m[2]);
}

export interface NavItem { label: string; href: string }

/** Main navigation, in the order specified for the site. Items whose page is not built yet are filtered out. */
export const MAIN_NAV: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  { label: "What We Do", href: "/services" },
  { label: "Industries", href: "/industries" },
  { label: "Insights", href: "/insights" },
  { label: "Our Approach", href: "/approach" },
  { label: "Careers", href: "/careers" },
  { label: "Contact", href: "/contact" },
];
export const COUNCIL_HREF = "/council";
export const LEGAL_NAV: NavItem[] = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms", href: "/terms" },
  { label: "Cookie Policy", href: "/cookie-policy" },
];
export const liveOnly = (items: NavItem[]) => items.filter((i) => isLive(i.href));
