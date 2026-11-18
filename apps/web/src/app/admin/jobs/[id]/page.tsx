import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EMPLOYMENT_TYPES, JOB_STATUSES, employmentLabel, getJobAdmin, getPrisma } from "@quantara/db";
import { can } from "@quantara/rbac";
import { Card } from "@/components/ui/layout";
import { requireStaff } from "@/lib/admin";
import { JobForm } from "../job-form";

export const metadata: Metadata = { title: "Edit job" };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff("job:write");
  const { id } = await params;
  const j = await getJobAdmin(getPrisma(), id);
  if (!j) notFound();
  return (
    <div className="max-w-2xl space-y-5">
      <Link href="/admin/jobs" className="text-sm text-electric-600 underline">← All jobs</Link>
      <h1 className="text-2xl font-semibold text-navy-900">{j.title}</h1>
      {can(s.ctx, "application:read") && <Link href={`/admin/applications?jobId=${j.id}`} className="text-sm text-electric-600 underline">View applications</Link>}
      <Card><JobForm canPublish={can(s.ctx, "job:publish")} types={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: employmentLabel(t) }))} statuses={[...JOB_STATUSES]}
        defaults={{ id: j.id, title: j.title, slug: j.slug, department: j.department, employmentType: j.employmentType, location: j.location, description: j.description,
          responsibilities: j.responsibilities.join("\n"), requirements: j.requirements.join("\n"), status: j.status === "IN_REVIEW" ? "DRAFT" : j.status, closesAt: j.closesAt ? j.closesAt.toISOString().slice(0, 10) : "" }} /></Card>
    </div>
  );
}
