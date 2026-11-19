import type { Metadata } from "next";
import Link from "next/link";
import { getPrisma, listCouncilAudit } from "@quantara/db";
import { Card } from "@/components/ui/layout";
import { requireStaff } from "@/lib/admin";

export const metadata: Metadata = { title: "Council audit log" };
const ID = /^[A-Za-z0-9_-]{8,64}$/;

export default async function CouncilAuditPage({ searchParams }: { searchParams: Promise<{ org?: string; page?: string }> }) {
  await requireStaff("audit:read");
  const sp = await searchParams;
  const org = sp.org && ID.test(sp.org) ? sp.org : undefined;
  const page = Math.max(parseInt(sp.page ?? "1", 10) || 1, 1);
  const data = await listCouncilAudit(getPrisma(), { organizationId: org, page });
  const qs = (p: number) => `?${new URLSearchParams({ ...(org ? { org } : {}), page: String(p) })}`;
  return (
    <div className="space-y-5">
      <p><Link href="/admin/council" className="text-sm font-medium text-electric-600 underline">Back to the council</Link></p>
      <h1 className="text-2xl font-semibold text-navy-900">Council audit log <span className="text-base font-normal text-slate-500">({data.total})</span></h1>
      {org && <p className="text-sm text-slate-600">Filtered to one workspace. <Link className="underline" href="/admin/council/audit">Show all</Link></p>}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-mist-200 text-slate-500"><tr><th className="p-3">When (UTC)</th><th className="p-3">Action</th><th className="p-3">Actor</th><th className="p-3">Resource</th><th className="p-3">Details</th></tr></thead>
          <tbody>
            {data.items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No entries.</td></tr>}
            {data.items.map((r) => (
              <tr key={r.id} className="border-b border-mist-100 align-top last:border-0">
                <td className="p-3 whitespace-nowrap">{r.at.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="p-3 font-medium">{r.action}</td>
                <td className="p-3 text-xs text-slate-600">{r.actorType}{r.actorId ? ` ${r.actorId.slice(0, 8)}` : ""}</td>
                <td className="p-3 text-xs text-slate-600">{r.resourceType ?? "—"}{r.resourceId ? ` ${r.resourceId.slice(0, 8)}` : ""}</td>
                <td className="p-3 text-xs text-slate-600"><code className="break-all">{r.metadata ? JSON.stringify(r.metadata) : ""}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {data.pages > 1 && <div className="flex items-center gap-3 text-sm">{data.page > 1 && <Link className="underline" href={qs(data.page - 1)}>Previous</Link>}<span>Page {data.page} of {data.pages}</span>{data.page < data.pages && <Link className="underline" href={qs(data.page + 1)}>Next</Link>}</div>}
    </div>
  );
}
