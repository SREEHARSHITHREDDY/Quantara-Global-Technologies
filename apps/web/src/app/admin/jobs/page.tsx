import type { Metadata } from "next";
import Link from "next/link";
import { getPrisma, listJobsAdmin } from "@quantara/db";
import { Badge, Card } from "@/components/ui/layout";
import { requireStaff } from "@/lib/admin";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage() {
  await requireStaff("job:write");
  const jobs = await listJobsAdmin(getPrisma());
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold text-navy-900">Jobs</h1><Link href="/admin/jobs/new" className="rounded-md bg-navy-900 px-4 py-2 text-sm font-medium text-white">New job</Link></div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-mist-200 text-slate-500"><tr><th className="p-3">Title</th><th className="p-3">Department</th><th className="p-3">Status</th><th className="p-3">Applications</th><th className="p-3">Closes</th></tr></thead>
          <tbody>
            {jobs.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No jobs yet.</td></tr>}
            {jobs.map((j: { id: string; title: string; department: string; status: string; closesAt: Date | null; _count: { applications: number } }) => (
              <tr key={j.id} className="border-b border-mist-100 last:border-0">
                <td className="p-3"><Link className="font-medium text-electric-600 underline" href={`/admin/jobs/${j.id}`}>{j.title}</Link></td>
                <td className="p-3">{j.department}</td><td className="p-3"><Badge>{j.status.toLowerCase()}</Badge></td>
                <td className="p-3">{j._count.applications}</td><td className="p-3">{j.closesAt ? j.closesAt.toISOString().slice(0, 10) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
