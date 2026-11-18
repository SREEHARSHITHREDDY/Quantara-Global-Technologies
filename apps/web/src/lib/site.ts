// Anything that is not in the corporate profile (contact details, legal name, leadership, socials)
// must come from SiteSetting rows via the CMS. Never hardcode it here.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
