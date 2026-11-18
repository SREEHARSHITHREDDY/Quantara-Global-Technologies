import { randomBytes } from "node:crypto";
import type { PrismaClient } from "./generated/client";

// STATUS: logic unit-tested without a database (enquiries.test.ts); database behaviour is covered by
// tests/enquiries.int.test.ts, which must be run with `pnpm test:db` (unverified until then).

export interface NewEnquiry {
  fullName: string;
  /** Stored trimmed and lower-case regardless of input. */
  businessEmail: string;
  organization: string;
  jobDesignation: string;
  phone?: string | undefined;
  country: string;
  serviceSlug?: string | undefined;
  industrySlug?: string | undefined;
  projectRequirements: string;
  engagementTimeline?: string | undefined;
  additionalInformation?: string | undefined;
  consentTextVersion: string;
  idempotencyKey?: string | undefined;
  ipHash?: string | undefined;
  userAgent?: string | undefined;
  spamScore: number;
  status: "RECEIVED" | "SPAM";
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/** e.g. QNT-ENQ-20261118-K7M2PX. Not secret; unique-constrained in the database. */
export function makeReferenceId(now: Date, prefix = "QNT-ENQ"): string {
  const day = now.toISOString().slice(0, 10).replaceAll("-", "");
  const bytes = randomBytes(6);
  let suffix = "";
  for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length];
  return `${prefix}-${day}-${suffix}`;
}

export function rateLimitWindowStart(now: Date, windowSeconds: number): Date {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / ms) * ms);
}

const isUniqueViolation = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

/** Atomic fixed-window counter shared by all app instances. */
export async function hitRateLimit(db: PrismaClient, key: string, windowSeconds: number, limit: number, now = new Date()): Promise<{ allowed: boolean; count: number }> {
  const windowStart = rateLimitWindowStart(now, windowSeconds);
  const row = await db.rateLimitBucket.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return { allowed: row.count <= limit, count: row.count };
}

/** Stores an enquiry. A repeated idempotency key returns the original reference instead of a second row. */
export async function createEnquiry(db: PrismaClient, input: NewEnquiry, now = new Date()): Promise<{ referenceId: string; duplicate: boolean }> {
  const existing = async () => {
    if (!input.idempotencyKey) return null;
    return db.contactEnquiry.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { referenceId: true } });
  };
  const prior = await existing();
  if (prior) return { referenceId: prior.referenceId, duplicate: true };

  const [service, industry] = await Promise.all([
    input.serviceSlug ? db.service.findUnique({ where: { slug: input.serviceSlug }, select: { id: true } }) : null,
    input.industrySlug ? db.industry.findUnique({ where: { slug: input.industrySlug }, select: { id: true } }) : null,
  ]);
  const referenceId = makeReferenceId(now);
  try {
    await db.contactEnquiry.create({
      data: {
        referenceId,
        fullName: input.fullName,
        businessEmail: input.businessEmail.trim().toLowerCase(),
        organization: input.organization,
        jobDesignation: input.jobDesignation,
        phone: input.phone ?? null,
        country: input.country,
        serviceId: service?.id ?? null,
        industryId: industry?.id ?? null,
        projectRequirements: input.projectRequirements,
        engagementTimeline: input.engagementTimeline ?? null,
        additionalInformation: input.additionalInformation ?? null,
        privacyConsent: true,
        consentAt: now,
        consentTextVersion: input.consentTextVersion,
        status: input.status,
        spamScore: input.spamScore,
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent?.slice(0, 300) ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      const again = await existing(); // concurrent double submit
      if (again) return { referenceId: again.referenceId, duplicate: true };
    }
    throw e;
  }
  return { referenceId, duplicate: false };
}
