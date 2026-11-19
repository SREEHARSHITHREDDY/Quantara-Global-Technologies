import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCouncilWorkspace, getPrisma } from "@quantara/db";
import { can } from "@quantara/rbac";
import { Badge, Card } from "@/components/ui/layout";
import { requireStaff } from "@/lib/admin";
import { compact, usd } from "@/lib/council-dashboard";
import { PlanForm } from "./plan-form";

export const metadata: Metadata = { title: "Workspace" };
const ID = /^[A-Za-z0-9_-]{8,64}$/;

export default async function WorkspacePage({ params }: { params: Promise<{ orgId: string }> }) {
  const s = await requireStaff("ai:usage:read");
  const { orgId } = await params;
  if (!ID.test(orgId)) notFound();
  const w = await getCouncilWorkspace(getPrisma(), orgId);
  if (!w) notFound();
  return (
    <div className="space-y-6">
      <p><Link href="/admin/council" className="text-sm font-medium text-electric-600 underline">Back to the council</Link></p>
      <h1 className="text-2xl font-semibold text-navy-900">{w.name}</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold text-navy-900">Council access</h2>
          <p className="mt-1 text-sm text-slate-600">Current plan: <Badge>{w.plan.toLowerCase()}</Badge>{w.trialEndsAt ? ` until ${w.trialEndsAt.toISOString().slice(0, 10)}` : ""} · {w.members} member(s)</p>
          <div className="mt-4"><PlanForm organizationId={w.id} plan={w.plan} maxConcurrent={w.maxConcurrent} canEdit={can(s.ctx, "ai:provider:manage")} /></div>
        </Card>
        <Card>
          <h2 className="text-base font-semibold text-navy-900">Recent sessions</h2>
          <p className="mt-1 text-xs text-slate-500">Operational data only. Prompts and results are not shown to staff.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {w.recent.length === 0 && <li className="text-slate-600">No sessions yet.</li>}
            {w.recent.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2"><span><Badge>{r.status.toLowerCase().replace(/_/g, " ")}</Badge> <span className="text-slate-600">{r.mode.toLowerCase().replace(/_/g, " ")}</span></span><span className="text-slate-500">{compact(r.tokensUsed)} tokens · {usd(r.costUsd)} · {r.createdAt.toISOString().slice(0, 10)}</span></li>)}
          </ul>
        </Card>
      </div>
      <p><Link href={`/admin/council/audit?org=${w.id}`} className="text-sm font-medium text-electric-600 underline">Audit entries for this workspace</Link></p>
    </div>
  );
}
