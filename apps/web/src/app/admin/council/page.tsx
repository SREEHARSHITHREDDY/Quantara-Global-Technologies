import type { Metadata } from "next";
import Link from "next/link";
import { getPlatformCouncilUsage, getPrisma, listCouncilWorkspaces } from "@quantara/db";
import { Badge, Card } from "@/components/ui/layout";
import { requireStaff } from "@/lib/admin";
import { compact, usd } from "@/lib/council-dashboard";

export const metadata: Metadata = { title: "Council" };

export default async function AdminCouncilPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireStaff("ai:usage:read");
  const sp = await searchParams;
  const page = Math.max(parseInt(sp.page ?? "1", 10) || 1, 1);
  const db = getPrisma();
  const [usage, ws] = await Promise.all([getPlatformCouncilUsage(db), listCouncilWorkspaces(db, { search: sp.q, page })]);
  const qs = (p: number) => `?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-navy-900">Executive Council</h1>
        <Link href="/admin/council/audit" className="text-sm font-medium text-electric-600 underline">Audit log</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="py-4"><p className="text-xs uppercase text-slate-500">Workspaces with access</p><p className="mt-1 text-2xl font-semibold">{usage.workspacesWithAccess}</p></Card>
        <Card className="py-4"><p className="text-xs uppercase text-slate-500">Sessions this month</p><p className="mt-1 text-2xl font-semibold">{usage.sessions}</p></Card>
        <Card className="py-4"><p className="text-xs uppercase text-slate-500">Tokens this month</p><p className="mt-1 text-2xl font-semibold">{compact(usage.tokens)}</p></Card>
        <Card className="py-4"><p className="text-xs uppercase text-slate-500">Cost this month</p><p className="mt-1 text-2xl font-semibold">{usd(usage.costUsd)}</p></Card>
      </div>
      <form className="flex gap-2" role="search"><label htmlFor="q" className="sr-only">Search workspaces</label><input id="q" name="q" defaultValue={sp.q} placeholder="Search workspaces" className="w-64 rounded-md border border-mist-200 bg-white px-3 py-2 text-sm" /><button className="rounded-md bg-navy-900 px-4 py-2 text-sm font-medium text-white">Search</button></form>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-mist-200 text-slate-500"><tr><th className="p-3">Workspace</th><th className="p-3">Plan</th><th className="p-3">Members</th><th className="p-3">Sessions</th><th className="p-3">Tokens (month)</th><th className="p-3">Cost (month)</th></tr></thead>
          <tbody>
            {ws.items.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No customer workspaces yet.</td></tr>}
            {ws.items.map((w) => (
              <tr key={w.id} className="border-b border-mist-100 last:border-0">
                <td className="p-3"><Link className="font-medium text-electric-600 underline" href={`/admin/council/${w.id}`}>{w.name}</Link></td>
                <td className="p-3"><Badge>{w.plan.toLowerCase()}</Badge>{w.plan === "TRIAL" && w.trialEndsAt && <span className="ml-1 text-xs text-slate-500">ends {w.trialEndsAt.toISOString().slice(0, 10)}</span>}</td>
                <td className="p-3">{w.members}</td><td className="p-3">{w.sessions}</td><td className="p-3">{compact(w.tokensThisMonth)}</td><td className="p-3">{usd(w.costThisMonth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {ws.pages > 1 && <div className="flex items-center gap-3 text-sm">{ws.page > 1 && <Link className="underline" href={qs(ws.page - 1)}>Previous</Link>}<span>Page {ws.page} of {ws.pages}</span>{ws.page < ws.pages && <Link className="underline" href={qs(ws.page + 1)}>Next</Link>}</div>}
    </div>
  );
}
