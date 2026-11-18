import { randomBytes } from "node:crypto";
import type { PrismaClient } from "./generated/client";

export type JobStatusValue = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
export type EmploymentTypeValue = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
export type ApplicationStatusValue = "RECEIVED" | "UNDER_REVIEW" | "SHORTLISTED" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED" | "WITHDRAWN";
export const EMPLOYMENT_TYPES: readonly EmploymentTypeValue[] = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"];
export const JOB_STATUSES: readonly JobStatusValue[] = ["DRAFT", "PUBLISHED", "ARCHIVED"]; // IN_REVIEW is reserved for the later review workflow
export const APPLICATION_STATUSES: readonly ApplicationStatusValue[] = ["RECEIVED", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN"];
export const employmentLabel = (t: string) => t.replace("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

const isUniqueViolation = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

export function slugify(input: string): string {
  return input.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
export function makeApplicationReference(now: Date): string {
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = ""; for (const b of randomBytes(6)) suffix += ALPHABET[b % ALPHABET.length];
  return `QNT-APP-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${suffix}`;
}

// ───────────── Public ─────────────

export interface PublicJob { id: string; slug: string; title: string; department: string; employmentType: EmploymentTypeValue; location: string; description: string; responsibilities: string[]; requirements: string[]; postedAt: Date | null; closesAt: Date | null }

/** A job is open when it is PUBLISHED and has not passed its closing date. */
export const openJobWhere = (now: Date) => ({ status: "PUBLISHED" as const, OR: [{ closesAt: null }, { closesAt: { gt: now } }] });

export async function listOpenJobs(db: PrismaClient, now = new Date()): Promise<PublicJob[]> {
  return db.job.findMany({ where: openJobWhere(now), orderBy: [{ postedAt: "desc" }, { title: "asc" }] });
}
export async function getOpenJob(db: PrismaClient, slug: string, now = new Date()): Promise<PublicJob | null> {
  return db.job.findFirst({ where: { slug, ...openJobWhere(now) } });
}

export interface NewApplication {
  jobId: string; applicantName: string; applicantEmail: string; phone?: string | undefined; coverLetter?: string | undefined;
  resumeStorageKey: string; resumeFilename: string; resumeMimeType: string; resumeSizeBytes: number; resumeSha256: string;
}
/** Creates the application and its first status event. A second application from the same email for the same job is reported, not duplicated. */
export async function createApplication(db: PrismaClient, input: NewApplication, now = new Date()): Promise<{ referenceId: string; duplicate: boolean }> {
  const job = await db.job.findFirst({ where: { id: input.jobId, ...openJobWhere(now) }, select: { id: true } });
  if (!job) throw new Error("This position is no longer open");
  const email = input.applicantEmail.trim().toLowerCase();
  const prior = await db.jobApplication.findUnique({ where: { jobId_applicantEmail: { jobId: input.jobId, applicantEmail: email } }, select: { referenceId: true } });
  if (prior) return { referenceId: prior.referenceId, duplicate: true };
  const referenceId = makeApplicationReference(now);
  try {
    await db.jobApplication.create({
      data: {
        referenceId, jobId: input.jobId, applicantName: input.applicantName, applicantEmail: email, phone: input.phone ?? null, coverLetter: input.coverLetter ?? null,
        resumeStorageKey: input.resumeStorageKey, resumeFilename: input.resumeFilename.slice(0, 200), resumeMimeType: input.resumeMimeType,
        resumeSizeBytes: input.resumeSizeBytes, resumeSha256: input.resumeSha256, privacyConsent: true, consentAt: now,
        events: { create: { toStatus: "RECEIVED", note: "Application received" } },
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      const again = await db.jobApplication.findUnique({ where: { jobId_applicantEmail: { jobId: input.jobId, applicantEmail: email } }, select: { referenceId: true } });
      if (again) return { referenceId: again.referenceId, duplicate: true };
    }
    throw e;
  }
  return { referenceId, duplicate: false };
}

// ───────────── Admin: jobs ─────────────

export interface JobInput {
  title: string; slug?: string | undefined; department: string; employmentType: EmploymentTypeValue; location: string; description: string;
  responsibilities: string[]; requirements: string[]; status: JobStatusValue; closesAt?: Date | null | undefined;
}
export async function listJobsAdmin(db: PrismaClient) {
  return db.job.findMany({ orderBy: [{ createdAt: "desc" }], select: { id: true, slug: true, title: true, department: true, status: true, location: true, postedAt: true, closesAt: true, _count: { select: { applications: true } } } });
}
export async function getJobAdmin(db: PrismaClient, id: string) { return db.job.findUnique({ where: { id } }); }

/** Splits a textarea into trimmed, non-empty lines. */
export const linesOf = (text: string): string[] => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 30).map((l) => l.slice(0, 300));

export type SaveJobResult = { ok: true; id: string; slug: string } | { ok: false; error: string };
/** Creates (id undefined) or updates a job. `canPublish` gates PUBLISHED: without it a job can only be saved as DRAFT or ARCHIVED. */
export async function saveJob(db: PrismaClient, id: string | undefined, input: JobInput, actorId: string, organizationId: string | null, canPublish: boolean, now = new Date()): Promise<SaveJobResult> {
  const slug = slugify(input.slug?.trim() || input.title);
  if (!slug) return { ok: false, error: "A title or slug is required" };
  const existing = id ? await db.job.findUnique({ where: { id }, select: { status: true, postedAt: true } }) : null;
  if (id && !existing) return { ok: false, error: "Job not found" };
  if (input.status === "PUBLISHED" && !canPublish && existing?.status !== "PUBLISHED") return { ok: false, error: "You do not have permission to publish jobs" };
  if (existing?.status === "PUBLISHED" && !canPublish) return { ok: false, error: "You do not have permission to change a published job" };
  const postedAt = input.status === "PUBLISHED" ? (existing?.postedAt ?? now) : (existing?.postedAt ?? null);
  const data = {
    slug, title: input.title, department: input.department, employmentType: input.employmentType, location: input.location, description: input.description,
    responsibilities: input.responsibilities, requirements: input.requirements, status: input.status, postedAt, closesAt: input.closesAt ?? null,
  };
  try {
    const row = id ? await db.job.update({ where: { id }, data, select: { id: true, slug: true } }) : await db.job.create({ data, select: { id: true, slug: true } });
    await db.auditLog.create({ data: { organizationId, actorId, action: id ? "job.updated" : "job.created", resourceType: "job", resourceId: row.id, metadata: { status: input.status } } });
    return { ok: true, id: row.id, slug: row.slug };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "Another job already uses this slug" };
    throw e;
  }
}

// ───────────── Admin: applications ─────────────

export interface ApplicationListOptions { jobId?: string; status?: ApplicationStatusValue; page?: number; pageSize?: number }
export interface ApplicationListItem { id: string; referenceId: string; applicantName: string; applicantEmail: string; status: ApplicationStatusValue; createdAt: Date; job: { title: string } }
export async function listApplications(db: PrismaClient, opts: ApplicationListOptions = {}): Promise<{ items: ApplicationListItem[]; total: number; page: number; pageSize: number; pages: number }> {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 1), 100); const page = Math.max(opts.page ?? 1, 1);
  const where = { ...(opts.jobId ? { jobId: opts.jobId } : {}), ...(opts.status ? { status: opts.status } : {}) };
  const [items, total] = await Promise.all([
    db.jobApplication.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, referenceId: true, applicantName: true, applicantEmail: true, status: true, createdAt: true, job: { select: { title: true } } } }),
    db.jobApplication.count({ where }),
  ]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
export async function getApplication(db: PrismaClient, id: string) {
  return db.jobApplication.findUnique({ where: { id }, include: { job: { select: { title: true, slug: true } }, events: { orderBy: { createdAt: "asc" } } } });
}
export async function setApplicationStatus(db: PrismaClient, id: string, status: ApplicationStatusValue, note: string | undefined, actorId: string, organizationId: string | null): Promise<boolean> {
  if (!APPLICATION_STATUSES.includes(status)) throw new Error("Invalid application status");
  return db.$transaction(async (tx: Pick<PrismaClient, "jobApplication" | "applicationStatusEvent" | "auditLog">) => {
    const cur = await tx.jobApplication.findUnique({ where: { id }, select: { status: true } });
    if (!cur) return false;
    if (cur.status !== status || note) {
      await tx.jobApplication.update({ where: { id }, data: { status } });
      await tx.applicationStatusEvent.create({ data: { applicationId: id, fromStatus: cur.status, toStatus: status, actorId, note: note?.trim().slice(0, 1000) || null } });
      await tx.auditLog.create({ data: { organizationId, actorId, action: "application.status.changed", resourceType: "job_application", resourceId: id, metadata: { from: cur.status, to: status } } });
    }
    return true;
  });
}
/** Records that a staff member downloaded a resume (personal data access is always audited). */
export async function auditResumeDownload(db: PrismaClient, applicationId: string, actorId: string, organizationId: string | null): Promise<void> {
  await db.auditLog.create({ data: { organizationId, actorId, action: "application.resume.downloaded", resourceType: "job_application", resourceId: applicationId } });
}
