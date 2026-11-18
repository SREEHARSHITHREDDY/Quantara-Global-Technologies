import { getPrisma } from "@quantara/db";
import { can } from "@quantara/rbac";
import { Card } from "@/components/ui/layout";
import { requireStaff } from "@/lib/admin";

export default async function AdminHome() {
  const s = await requireStaff();
  const db = getPrisma();
  const newEnquiries = can(s.ctx, "enquiry:read") ? await db.contactEnquiry.count({ where: { status: "RECEIVED" } }) : null;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-navy-900">Welcome, {s.name}</h1>
      <p className="text-sm text-slate-600">Your role: {s.ctx.role}. You only see the areas your role permits.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {newEnquiries !== null && <Card><p className="text-sm text-slate-600">New enquiries</p><p className="mt-1 text-3xl font-semibold text-navy-900">{newEnquiries}</p></Card>}
      </div>
    </div>
  );
}
