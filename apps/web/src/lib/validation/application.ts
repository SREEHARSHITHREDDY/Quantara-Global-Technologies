import { z } from "zod";

export const APPLICATION_CONSENT_VERSION = "v1";
export const APPLICATION_CONSENT_TEXT = "I agree that Quantara Technologies may store and use my application and resume to assess my suitability for this and future roles, as described in the Privacy Policy.";

const text = (label: string, max: number, min = 2) => z.string({ error: `${label} is required` }).trim().min(min, `${label} is required`).max(max, `${label} is too long`);

export const applicationSchema = z.object({
  jobId: z.string().trim().min(1, "Missing job"),
  applicantName: text("Full name", 120),
  applicantEmail: z.string({ error: "Email is required" }).trim().toLowerCase().max(254, "Email is too long").pipe(z.email("Enter a valid email address")),
  phone: z.string().trim().optional().transform((v) => (v ? v : undefined)).refine((v) => v === undefined || /^[+0-9 ()\-.]{6,24}$/.test(v), "Enter a valid phone number"),
  coverLetter: z.string().trim().max(4000, "Too long").optional().transform((v) => (v ? v : undefined)),
  privacyConsent: z.string().optional().refine((v) => v === "on" || v === "true", "You must agree to continue"),
});
export type ApplicationFields = z.infer<typeof applicationSchema>;
