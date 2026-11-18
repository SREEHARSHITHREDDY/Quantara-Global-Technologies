import type { Metadata } from "next";
import Link from "next/link";
import { ENQUIRY_STATUSES, getPrisma, listEnquiries, type EnquiryStatusValue } from "@quantara/db";
import { Badge, Card } from "@/components/ui/layout";
import { requireStaff } from "@/lib/admin";

export const metadata: Metadata = { title: "Enquiries" };

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireStaff("enquiry:read");
  const sp = await searchParams;
  const status = ENQUIRY_STATUSES.find((x) => x === sp.status) as EnquiryStatusValue | undefined;
  const page = Math.max(parseInt(sp.page ?? "1", 10) || 1, 1);
  const data = await listEnquiries(getPrisma(), { status, page });
  const qs = (p: number) => `?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) })}`;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-navy-900">Enquiries <span className="text-base font-normal text-slate-500">({data.total})</span></h1>
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/enquiries" className={`rounded-full border px-3 py-1 ${!status ? "border-navy-900 bg-navy-900 text-white" : "border-mist-200 bg-white text-slate-700"}`}>All</Link>
        {ENQUIRY_STATUSES.map((st) => <Link key={st} href={`/admin/enquiries?status=${st}`} className={`rounded-full border px-3 py-1 ${status === st ? "border-navy-900 bg-navy-900 text-white" : "border-mist-200 bg-white text-slate-700"}`}>{st.toLowerCase()}</Link>)}
      </nav>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-mist-200 text-slate-500"><tr><th className="p-3">Reference</th><th className="p-3">From</th><th className="p-3">Organisation</th><th className="p-3">Service</th><th className="p-3">Status</th><th className="p-3">Received</th></tr></thead>
          <tbody>
            {data.items.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No enquiries yet.</td></tr>}
            {data.items.map((e) => (
              <tr key={e.id} className="border-b border-mist-100 last:border-0">
                <td className="p-3"><Link className="font-medium text-electric-600 underline" href={`/admin/enquiries/${e.id}`}>{e.referenceId}</Link></td>
                <td className="p-3">{e.fullName}<div className="text-xs text-slate-500">{e.businessEmail}</div></td>
                <td className="p-3">{e.organization}</td>
                <td className="p-3">{e.service?.title ?? "—"}</td>
                <td className="p-3"><Badge>{e.status.toLowerCase()}</Badge>{e.spamScore >= 50 && <span className="ml-1 text-xs text-amber-700">likely spam</span>}</td>
                <td className="p-3 whitespace-nowrap">{e.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {data.pages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {data.page > 1 && <Link className="underline" href={qs(data.page - 1)}>Previous</Link>}
          <span>Page {data.page} of {data.pages}</span>
          {data.page < data.pages && <Link className="underline" href={qs(data.page + 1)}>Next</Link>}
        </div>
      )}
    </div>
  );
}
