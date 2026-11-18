import type { Metadata } from "next";
import Link from "next/link";
import { APPLICATION_STATUSES, getPrisma, listApplications, type ApplicationStatusValue } from "@quantara/db";
import { Badge, Card } from "@/components/ui/layout";
import { requireStaff } from "@/lib/admin";

export const metadata: Metadata = { title: "Applications" };

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; jobId?: string }> }) {
  await requireStaff("application:read");
  const sp = await searchParams;
  const status = APPLICATION_STATUSES.find((x) => x === sp.status) as ApplicationStatusValue | undefined;
  const page = Math.max(parseInt(sp.page ?? "1", 10) || 1, 1);
  const data = await listApplications(getPrisma(), { status, page, jobId: sp.jobId || undefined });
  const qs = (p: number) => `?${new URLSearchParams({ ...(status ? { status } : {}), ...(sp.jobId ? { jobId: sp.jobId } : {}), page: String(p) })}`;
  const pill = (active: boolean) => `rounded-full border px-3 py-1 ${active ? "border-navy-900 bg-navy-900 text-white" : "border-mist-200 bg-white text-slate-700"}`;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-navy-900">Applications <span className="text-base font-normal text-slate-500">({data.total})</span></h1>
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2 text-sm">
        <Link href={sp.jobId ? `/admin/applications?jobId=${sp.jobId}` : "/admin/applications"} className={pill(!status)}>All</Link>
        {APPLICATION_STATUSES.map((st) => <Link key={st} href={`/admin/applications?${new URLSearchParams({ status: st, ...(sp.jobId ? { jobId: sp.jobId } : {}) })}`} className={pill(status === st)}>{st.replace("_", " ").toLowerCase()}</Link>)}
      </nav>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-mist-200 text-slate-500"><tr><th className="p-3">Reference</th><th className="p-3">Applicant</th><th className="p-3">Job</th><th className="p-3">Status</th><th className="p-3">Received</th></tr></thead>
          <tbody>
            {data.items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No applications yet.</td></tr>}
            {data.items.map((a) => (
              <tr key={a.id} className="border-b border-mist-100 last:border-0">
                <td className="p-3"><Link className="font-medium text-electric-600 underline" href={`/admin/applications/${a.id}`}>{a.referenceId}</Link></td>
                <td className="p-3">{a.applicantName}<div className="text-xs text-slate-500">{a.applicantEmail}</div></td>
                <td className="p-3">{a.job.title}</td><td className="p-3"><Badge>{a.status.replace("_", " ").toLowerCase()}</Badge></td>
                <td className="p-3 whitespace-nowrap">{a.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {data.pages > 1 && <div className="flex items-center gap-3 text-sm">{data.page > 1 && <Link className="underline" href={qs(data.page - 1)}>Previous</Link>}<span>Page {data.page} of {data.pages}</span>{data.page < data.pages && <Link className="underline" href={qs(data.page + 1)}>Next</Link>}</div>}
    </div>
  );
}
