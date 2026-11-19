import Link from "next/link";
import type { CouncilDashboard } from "@quantara/db";
import { Badge, Card } from "@/components/ui/layout";
import { compact, percentOf, usd } from "@/lib/council-dashboard";
import { STAGE_LABELS } from "@/lib/council-progress";

function Tile({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = <Card className="py-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold text-navy-900">{value}</p></Card>;
  return href ? <Link href={href} className="block hover:opacity-90">{body}</Link> : body;
}

export function DashboardPanel({ d }: { d: CouncilDashboard }) {
  const tokenPct = percentOf(d.usage.tokens, d.usage.tokenBudget);
  const costPct = percentOf(d.usage.costUsd, d.usage.costBudgetUsd);
  return (
    <section aria-label="Council overview" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label={d.scope === "org" ? "Sessions (organization)" : "Your sessions"} value={d.totalSessions} />
        <Tile label="Running now" value={d.activeRuns} />
        <Tile label="Completed reports" value={d.completedReports} />
        <Tile label="Approvals waiting" value={d.pendingApprovals} href="/council/approvals" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-navy-900">Usage this month</h2>
          <p className="mt-2 text-sm text-slate-700">{compact(d.usage.tokens)} tokens{d.usage.tokenBudget ? ` of ${compact(d.usage.tokenBudget)}` : ""} · {usd(d.usage.costUsd)}{d.usage.costBudgetUsd ? ` of ${usd(d.usage.costBudgetUsd)}` : ""}</p>
          {(tokenPct !== null || costPct !== null) && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-mist-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(tokenPct ?? 0, costPct ?? 0)} aria-label="Share of the monthly budget used">
              <div className="h-full bg-electric-600" style={{ width: `${Math.max(tokenPct ?? 0, costPct ?? 0)}%` }} />
            </div>
          )}
          {d.scope === "own" && <p className="mt-2 text-xs text-slate-500">Your own usage. Budgets are shown to organization administrators.</p>}
        </Card>
        <Card>
          <h2 className="text-sm font-semibold text-navy-900">Recent activity</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {d.recentActivity.length === 0 && <li className="text-slate-600">No activity yet.</li>}
            {d.recentActivity.map((a) => (
              <li key={`${a.kind}-${a.id}`} className="flex items-start justify-between gap-3">
                <Link href={a.href} className="line-clamp-1 text-slate-700 hover:text-electric-600">{a.kind === "approval" ? "Approval: " : ""}{a.label}</Link>
                <Badge className="shrink-0">{STAGE_LABELS[a.status] ?? a.status.toLowerCase()}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}
