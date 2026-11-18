import { createHash } from "node:crypto";
import type { NewEnquiry } from "@quantara/db";
import { CONSENT_TEXT_VERSION, enquirySchema } from "@/lib/validation/enquiry";

export type EnquiryState =
  | { status: "idle" }
  | { status: "success"; referenceId: string }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string[] | undefined> };

export interface EnquiryDeps {
  createEnquiry(input: NewEnquiry): Promise<{ referenceId: string; duplicate: boolean }>;
  hitRateLimit(key: string, windowSeconds: number, limit: number): Promise<{ allowed: boolean }>;
  now(): Date;
  ipSalt: string;
}
export interface RequestContext { ip: string; userAgent: string }

export const LIMITS = { perIpPerHour: 5, perEmailPerHour: 3, windowSeconds: 3600, minFillSeconds: 3, spamThreshold: 50 } as const;
export const hashIp = (ip: string, salt: string) => createHash("sha256").update(`${salt}:${ip}`).digest("hex");
const hashEmail = (email: string, salt: string) => createHash("sha256").update(`${salt}:email:${email}`).digest("hex");

/** Heuristic only (honeypot, speed, link count). A score at or above the threshold stores the enquiry as SPAM. */
export function spamScore(raw: Record<string, unknown>, requirements: string, now: Date): number {
  let score = 0;
  if (typeof raw.website === "string" && raw.website.trim() !== "") score += 100; // honeypot field
  const started = Number(raw.startedAt);
  if (!Number.isFinite(started) || started <= 0) score += 30;
  else if ((now.getTime() - started) / 1000 < LIMITS.minFillSeconds) score += 60;
  if ((requirements.match(/https?:\/\//gi) ?? []).length > 3) score += 40;
  return score;
}

export async function processEnquiry(raw: Record<string, unknown>, ctx: RequestContext, deps: EnquiryDeps): Promise<EnquiryState> {
  const ipHash = hashIp(ctx.ip, deps.ipSalt);
  const ipLimit = await deps.hitRateLimit(`enquiry:ip:${ipHash}`, LIMITS.windowSeconds, LIMITS.perIpPerHour);
  if (!ipLimit.allowed) return { status: "error", message: "Too many submissions from your connection. Please try again later." };

  const parsed = enquirySchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[] | undefined> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "form");
      (fieldErrors[k] ??= []).push(issue.message);
    }
    return { status: "error", message: "Please correct the highlighted fields.", fieldErrors };
  }
  const d = parsed.data;

  const emailLimit = await deps.hitRateLimit(`enquiry:email:${hashEmail(d.businessEmail, deps.ipSalt)}`, LIMITS.windowSeconds, LIMITS.perEmailPerHour);
  if (!emailLimit.allowed) return { status: "error", message: "We have already received several enquiries from this email address. Please try again later." };

  const score = spamScore(raw, d.projectRequirements, deps.now());
  const result = await deps.createEnquiry({
    fullName: d.fullName, businessEmail: d.businessEmail, organization: d.organization, jobDesignation: d.jobDesignation,
    phone: d.phone, country: d.country, serviceSlug: d.serviceSlug, industrySlug: d.industrySlug,
    projectRequirements: d.projectRequirements, engagementTimeline: d.engagementTimeline, additionalInformation: d.additionalInformation,
    consentTextVersion: CONSENT_TEXT_VERSION, idempotencyKey: d.idempotencyKey, ipHash, userAgent: ctx.userAgent,
    spamScore: score, status: score >= LIMITS.spamThreshold ? "SPAM" : "RECEIVED",
  });
  // Spam is stored (so it can be reviewed) but looks identical to the sender.
  return { status: "success", referenceId: result.referenceId };
}
