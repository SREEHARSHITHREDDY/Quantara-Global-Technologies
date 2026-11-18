"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { EMPLOYMENT_TYPES, JOB_STATUSES, getPrisma, linesOf, saveJob, type EmploymentTypeValue, type JobStatusValue } from "@quantara/db";
import { can } from "@quantara/rbac";
import { requireStaff } from "@/lib/admin";

export interface JobFormState { status: "idle" | "saved" | "error"; message?: string; fieldErrors?: Record<string, string> }

const schema = z.object({
  title: z.string().trim().min(3, "Title is required").max(140),
  slug: z.string().trim().max(80).optional(),
  department: z.string().trim().min(2, "Department is required").max(100),
  employmentType: z.enum(EMPLOYMENT_TYPES as [EmploymentTypeValue, ...EmploymentTypeValue[]], { error: "Choose an employment type" }),
  location: z.string().trim().min(2, "Location is required").max(120),
  description: z.string().trim().min(20, "Describe the role (at least 20 characters)").max(8000),
  responsibilities: z.string().max(9000).default(""),
  requirements: z.string().max(9000).default(""),
  status: z.enum(JOB_STATUSES as [JobStatusValue, ...JobStatusValue[]], { error: "Choose a status" }),
  closesAt: z.string().optional(),
});

export async function saveJobAction(_prev: JobFormState, formData: FormData): Promise<JobFormState> {
  const s = await requireStaff("job:write"); // re-checked on every submit
  const id = String(formData.get("id") ?? "") || undefined;
  const raw: Record<string, unknown> = {}; formData.forEach((v, k) => { if (typeof v === "string") raw[k] = v; });
  const p = schema.safeParse(raw);
  if (!p.success) {
    const fieldErrors: Record<string, string> = {}; for (const i of p.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors };
  }
  const d = p.data;
  let closesAt: Date | null = null;
  if (d.closesAt) { closesAt = new Date(`${d.closesAt}T23:59:59.000Z`); if (Number.isNaN(closesAt.getTime())) return { status: "error", fieldErrors: { closesAt: "Enter a valid date" } }; }
  const r = await saveJob(getPrisma(), id, {
    title: d.title, slug: d.slug, department: d.department, employmentType: d.employmentType, location: d.location, description: d.description,
    responsibilities: linesOf(d.responsibilities), requirements: linesOf(d.requirements), status: d.status, closesAt,
  }, s.userId, s.organizationId, can(s.ctx, "job:publish"));
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/admin/jobs"); revalidatePath("/careers");
  if (!id) redirect(`/admin/jobs/${r.id}`);
  return { status: "saved", message: "Saved." };
}
