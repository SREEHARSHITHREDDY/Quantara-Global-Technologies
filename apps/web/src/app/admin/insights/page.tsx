import type { Metadata } from "next";
import Link from "next/link";
import { getPrisma, listInsightsAdmin } from "@quantara/db";
import { Badge, Card } from "@/components/ui/layout";
import { requireStaff } from "@/lib/admin";

export const metadata: Metadata = { title: "Insights" };

export default async function InsightsAdminPage() {
  await requireStaff("insight:write");
  const items = await listInsightsAdmin(getPrisma());
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold text-navy-900">Insights</h1><Link href="/admin/insights/new" className="rounded-md bg-navy-900 px-4 py-2 text-sm font-medium text-white">New article</Link></div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-mist-200 text-slate-500"><tr><th className="p-3">Title</th><th className="p-3">Category</th><th className="p-3">Status</th><th className="p-3">Published</th><th className="p-3">Updated</th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No articles yet.</td></tr>}
            {items.map((a: { id: string; title: string; status: string; publishedAt: Date | null; updatedAt: Date; category: { name: string } | null }) => (
              <tr key={a.id} className="border-b border-mist-100 last:border-0">
                <td className="p-3"><Link className="font-medium text-electric-600 underline" href={`/admin/insights/${a.id}`}>{a.title}</Link></td>
                <td className="p-3">{a.category?.name ?? "—"}</td><td className="p-3"><Badge>{a.status.toLowerCase()}</Badge></td>
                <td className="p-3">{a.publishedAt ? a.publishedAt.toISOString().slice(0, 10) : "—"}</td><td className="p-3">{a.updatedAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
