import type { Metadata } from "next";
import { EMPLOYMENT_TYPES, JOB_STATUSES, employmentLabel } from "@quantara/db";
import { can } from "@quantara/rbac";
import { Card } from "@/components/ui/layout";
import { requireStaff } from "@/lib/admin";
import { JobForm } from "../job-form";

export const metadata: Metadata = { title: "New job" };

export default async function NewJobPage() {
  const s = await requireStaff("job:write");
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold text-navy-900">New job</h1>
      <Card><JobForm canPublish={can(s.ctx, "job:publish")} types={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: employmentLabel(t) }))} statuses={[...JOB_STATUSES]}
        defaults={{ title: "", slug: "", department: "", employmentType: "FULL_TIME", location: "", description: "", responsibilities: "", requirements: "", status: "DRAFT", closesAt: "" }} /></Card>
    </div>
  );
}
