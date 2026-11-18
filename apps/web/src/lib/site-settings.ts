import { getPrisma, getPublicSettings } from "@quantara/db";

export interface SiteContact {
  email?: string; phone?: string; address?: string;
  legalName?: string; registrationNumber?: string;
  linkedin?: string; x?: string;
}

const isHttps = (v: string | undefined): v is string => !!v && /^https:\/\/[^\s]+$/.test(v);
const isEmail = (v: string | undefined): v is string => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Pure mapping from stored public settings to what the site renders. Anything malformed is dropped. */
export function toSiteContact(s: Record<string, string>): SiteContact {
  const out: SiteContact = {};
  if (isEmail(s["contact.email"])) out.email = s["contact.email"];
  if (s["contact.phone"]) out.phone = s["contact.phone"];
  if (s["contact.address"]) out.address = s["contact.address"];
  if (s["company.legalName"]) out.legalName = s["company.legalName"];
  if (s["company.registrationNumber"]) out.registrationNumber = s["company.registrationNumber"];
  if (isHttps(s["social.linkedin"])) out.linkedin = s["social.linkedin"];
  if (isHttps(s["social.x"])) out.x = s["social.x"];
  return out;
}

/** Never throws: if the database is unavailable (e.g. during a build) the site simply shows no contact details. */
export async function getSiteContact(): Promise<SiteContact> {
  try { return toSiteContact(await getPublicSettings(getPrisma())); }
  catch { return {}; }
}

/** `tel:` href that keeps only digits and a leading +. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
