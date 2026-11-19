/**
 * Response headers for every page. The Content-Security-Policy here is the part that is safe without a browser to test it:
 * it blocks framing, plugins, base-tag and cross-site form tricks. A strict script-src with a per-request nonce is a separate step
 * (it can break the site if wrong), planned once the pages have been checked in a browser.
 */
export const CSP_DIRECTIVES = ["frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"] as const;

export const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP_DIRECTIVES.join("; ") },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
] as const;
