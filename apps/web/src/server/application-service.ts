import { createHash } from "node:crypto";
import type { NewApplication } from "@quantara/db";
import { MAX_RESUME_BYTES, safeFilename, sniffResume } from "@/lib/resume";
import { applicationSchema } from "@/lib/validation/application";
import type { ResumeStorage } from "@/server/resume-storage";

export type ApplicationState =
  | { status: "idle" }
  | { status: "success"; referenceId: string; duplicate: boolean }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string[] | undefined> };

export interface ApplicationDeps {
  storage: ResumeStorage | null;
  createApplication(input: NewApplication): Promise<{ referenceId: string; duplicate: boolean }>;
  hitRateLimit(key: string, windowSeconds: number, limit: number): Promise<{ allowed: boolean }>;
  now(): Date;
  ipSalt: string;
}
export const APPLY_LIMITS = { perIpPerHour: 6, perEmailPerDay: 3, minFillSeconds: 4 } as const;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export async function processApplication(raw: Record<string, unknown>, file: { name: string; bytes: Uint8Array } | null, ip: string, deps: ApplicationDeps): Promise<ApplicationState> {
  if (!deps.storage) return { status: "error", message: "Applications are temporarily unavailable. Please try again later." };
  // Bots: a filled honeypot or a form submitted faster than a person could. Both get a normal-looking success without storing anything.
  const started = Number(raw.startedAt); const fast = Number.isFinite(started) && started > 0 && (deps.now().getTime() - started) / 1000 < APPLY_LIMITS.minFillSeconds;
  if ((typeof raw.website === "string" && raw.website.trim() !== "") || fast) return { status: "success", referenceId: "QNT-APP-RECEIVED", duplicate: false };

  const ip1 = await deps.hitRateLimit(`apply:ip:${sha(`${deps.ipSalt}:${ip}`)}`, 3600, APPLY_LIMITS.perIpPerHour);
  if (!ip1.allowed) return { status: "error", message: "Too many submissions from your connection. Please try again later." };

  const parsed = applicationSchema.safeParse(raw);
  const fieldErrors: Record<string, string[] | undefined> = {};
  if (!parsed.success) for (const i of parsed.error.issues) (fieldErrors[String(i.path[0] ?? "form")] ??= []).push(i.message);

  let kind = null as ReturnType<typeof sniffResume>;
  if (!file || file.bytes.length === 0) fieldErrors.resume = ["Attach your resume"];
  else if (file.bytes.length > MAX_RESUME_BYTES) fieldErrors.resume = ["The file is larger than 5 MB"];
  else { kind = sniffResume(file.bytes); if (!kind) fieldErrors.resume = ["Upload a PDF or Word document (.pdf, .docx, .doc)"]; }
  if (!parsed.success || Object.keys(fieldErrors).length) return { status: "error", message: "Please correct the highlighted fields.", fieldErrors };

  const d = parsed.data;
  const emailLimit = await deps.hitRateLimit(`apply:email:${sha(`${deps.ipSalt}:${d.applicantEmail}`)}`, 86400, APPLY_LIMITS.perEmailPerDay);
  if (!emailLimit.allowed) return { status: "error", message: "We have already received several applications from this email address. Please try again later." };

  const bytes = file!.bytes; const key = await deps.storage.put(bytes);
  try {
    const r = await deps.createApplication({
      jobId: d.jobId, applicantName: d.applicantName, applicantEmail: d.applicantEmail, phone: d.phone, coverLetter: d.coverLetter,
      resumeStorageKey: key, resumeFilename: safeFilename(file!.name, kind!.ext), resumeMimeType: kind!.mime, resumeSizeBytes: bytes.length,
      resumeSha256: createHash("sha256").update(bytes).digest("hex"),
    });
    if (r.duplicate) await deps.storage.remove(key); // the earlier application keeps its own file
    return { status: "success", referenceId: r.referenceId, duplicate: r.duplicate };
  } catch (e) {
    await deps.storage.remove(key).catch(() => {}); // never leave an orphaned personal document behind
    throw e;
  }
}
