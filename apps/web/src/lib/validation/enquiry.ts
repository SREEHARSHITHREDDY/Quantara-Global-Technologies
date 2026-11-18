import { industries, services } from "@quantara/content";
import { z } from "zod";

/** Bump when the consent wording shown on the form changes; stored with each enquiry. */
export const CONSENT_TEXT_VERSION = "v1";
export const CONSENT_TEXT = "I agree that Quantara Technologies may use the information I provide to respond to my enquiry, as described in the Privacy Policy.";
export const TIMELINES = ["Immediately", "Within 3 months", "3 to 6 months", "More than 6 months", "Just exploring"] as const;

const text = (label: string, max: number, min = 2) =>
  z.string({ error: `${label} is required` }).trim().min(min, `${label} is required`).max(max, `${label} is too long`);
const optionalText = (max: number) => z.string().trim().max(max, "Too long").optional().transform((v) => (v ? v : undefined));
const slugOf = (list: { slug: string }[]) => z.string().optional().transform((v) => (v ? v : undefined)).refine((v) => v === undefined || list.some((x) => x.slug === v), "Choose an option from the list");

export const enquirySchema = z.object({
  fullName: text("Full name", 120),
  businessEmail: z.string({ error: "Business email is required" }).trim().toLowerCase().max(254, "Email is too long").pipe(z.email("Enter a valid email address")),
  organization: text("Organization", 160),
  jobDesignation: text("Job designation", 120),
  phone: z.string().trim().optional().transform((v) => (v ? v : undefined)).refine((v) => v === undefined || /^[+0-9 ()\-.]{6,24}$/.test(v), "Enter a valid phone number"),
  country: text("Country", 80),
  serviceSlug: slugOf(services),
  industrySlug: slugOf(industries),
  projectRequirements: text("Project requirements", 4000, 20),
  engagementTimeline: z.string().optional().transform((v) => (v ? v : undefined)).refine((v) => v === undefined || (TIMELINES as readonly string[]).includes(v), "Choose an option from the list"),
  additionalInformation: optionalText(4000),
  privacyConsent: z.string().optional().refine((v) => v === "on" || v === "true", "You must agree to continue"),
  idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9-]{16,64}$/).optional().catch(undefined),
});
export type EnquiryFields = z.infer<typeof enquirySchema>;
