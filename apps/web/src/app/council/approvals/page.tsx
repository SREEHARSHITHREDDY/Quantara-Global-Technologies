import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { APPROVAL_CATEGORY_LABELS, type ApprovalCategoryId } from "@quantara/council";
import { getPrisma, listApprovals } from "@quantara/db";
import { PageHero } from "@/components/site/page-hero";
import { Badge, Card, Container } from "@/components/ui/layout";
import { getCouncilCaller } from "@/lib/council-caller";
import { listApprovalsFor } from "@/server/council-service";
import { DecisionButtons } from "./decision-buttons";

export const metadata: Metadata = { title: "Approvals", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { PENDING: "Waiting for a decision", APPROVED: "Approved", REJECTED: "Rejected", EXPIRED: "Expired", CANCELLED: "Cancelled" };
const date = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function ApprovalsPage() {
  const caller = await getCouncilCaller();
  if (!caller) redirect("/sign-in");
  const db = getPrisma();
  const r = await listApprovalsFor(caller, { list: (a) => listApprovals(db, a) });
  if (!r.ok) redirect("/council");
  const pending = r.approvals.filter((a) => a.status === "PENDING");
  const decided = r.approvals.filter((a) => a.status !== "PENDING");
  return (
    <>
      <PageHero eyebrow="Executive Council" title="Approvals" description="Agents prepare actions; people decide. Approving here records your decision. It does not carry out the action." />
      <section className="bg-mist-50 py-12 sm:py-16">
        <Container className="max-w-4xl space-y-10">
          <p><Link href="/council" className="text-sm font-medium text-electric-600 underline">Back to the council</Link></p>
          <div>
            <h2 className="text-lg font-semibold text-navy-900">Waiting for a decision ({pending.length})</h2>
            <ul className="mt-4 space-y-4">
              {pending.length === 0 && <li className="text-sm text-slate-600">Nothing is waiting.</li>}
              {pending.map((a) => (
                <li key={a.id}><Card>
                  <div className="flex flex-wrap items-center gap-2"><Badge>{APPROVAL_CATEGORY_LABELS[a.category as ApprovalCategoryId] ?? a.category}</Badge>{a.agent && <Badge>Requested by {a.agent}</Badge>}{a.expiresAt && <span className="text-xs text-slate-500">expires {date(a.expiresAt)}</span>}</div>
                  <h3 className="mt-3 font-semibold text-navy-900">{a.title}</h3>
                  <p className="mt-1 text-sm text-slate-700">Reason: {a.description}</p>
                  {a.executionId && <p className="mt-2 text-sm"><Link className="text-electric-600 underline" href={`/council/${a.executionId}`}>View the consultation</Link></p>}
                  {r.canDecide ? <DecisionButtons id={a.id} /> : <p className="mt-3 text-sm text-slate-500">A person with approval authority in your organization will decide this.</p>}
                </Card></li>
              ))}
            </ul>
          </div>
          {decided.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-navy-900">Decided</h2>
              <ul className="mt-4 space-y-3">
                {decided.map((a) => (
                  <li key={a.id} className="rounded-lg border border-mist-200 bg-white p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2"><Badge>{STATUS[a.status] ?? a.status}</Badge><span className="text-slate-500">{APPROVAL_CATEGORY_LABELS[a.category as ApprovalCategoryId] ?? a.category}</span>{a.decidedAt && <span className="text-xs text-slate-500">{date(a.decidedAt)}</span>}</div>
                    <p className="mt-2 font-medium text-navy-900">{a.title}</p>
                    {a.decisionNote && <p className="mt-1 text-slate-600">Note: {a.decisionNote}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
