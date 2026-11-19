import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AGENTS, TEMPLATES, councilAccess, type ConsultationMode } from "@quantara/council";
import { getCouncilOrgAccess, getPrisma, listApprovals, listExecutionsForUser } from "@quantara/db";
import { can } from "@quantara/rbac";
import { PageHero } from "@/components/site/page-hero";
import { Badge, Card, Container } from "@/components/ui/layout";
import { STAGE_LABELS } from "@/lib/council-progress";
import { getCouncilCaller } from "@/lib/council-caller";
import { councilProviderChoices } from "@/server/council-runtime";
import { StartForm } from "./start-form";

export const metadata: Metadata = { title: "Executive Council", robots: { index: false } };
export const dynamic = "force-dynamic";

const MODES: { id: ConsultationMode; label: string; help: string }[] = [
  { id: "INDIVIDUAL", label: "One executive", help: "Ask a single executive for their view." },
  { id: "MULTI_EXECUTIVE", label: "Selected executives", help: "Choose the executives who should assess." },
  { id: "CEO_RECOMMENDATION", label: "CEO recommends", help: "The CEO chooses a focused group for you." },
  { id: "FULL_COUNCIL", label: "Full council", help: "All ten executives assess and the CEO consolidates." },
];

export default async function CouncilPage() {
  const caller = await getCouncilCaller();
  if (!caller) redirect("/sign-in");
  const db = getPrisma();
  const org = await getCouncilOrgAccess(db, caller.organizationId);
  const access = org ? councilAccess({ plan: org.plan, trialEndsAt: org.trialEndsAt, maxConcurrentOverride: org.maxConcurrentOverride }) : null;
  const allowedToUse = can(caller.ctx, "council:use");

  if (!allowedToUse || !access || !access.allowed) {
    const expired = access && !access.allowed && access.reason === "trial_expired";
    return (
      <>
        <PageHero eyebrow="Executive Council" title={expired ? "Your trial has ended" : "Not enabled for your workspace yet"} description="The Executive Council gives you assessments from ten simulated C-suite executives, led by a CEO who consolidates them." />
        <section className="bg-mist-50 py-12"><Container className="max-w-3xl"><Card>
          <p className="text-slate-700">{!allowedToUse ? "Your role does not include access to the council." : expired ? "Contact Quantara to continue using the council." : "Access is switched on by Quantara for each workspace. Contact us to request a trial."}</p>
          <p className="mt-4"><Link className="font-medium text-electric-600 underline" href="/contact">Contact Quantara</Link></p>
        </Card></Container></section>
      </>
    );
  }

  const pendingCount = (await listApprovals(db, { organizationId: caller.organizationId, userId: caller.userId, scope: can(caller.ctx, "council:approval:decide") ? "org" : "own", status: "PENDING" })).length;
  const [history, providers] = await Promise.all([
    listExecutionsForUser(db, { organizationId: caller.organizationId, userId: caller.userId, orgWide: can(caller.ctx, "council:history:read:org") }),
    councilProviderChoices(),
  ]);
  const modes = MODES.map((m) => ({ ...m, allowed: access.limits.modes.includes(m.id) }));
  return (
    <>
      <PageHero eyebrow="Executive Council" title="Consult your executive team" description="Output is advisory. It supports a decision and does not replace professional advice." />
      <section className="bg-mist-50 py-12 sm:py-16">
        <Container className="grid max-w-6xl gap-8 lg:grid-cols-[3fr_2fr]">
          <Card>
            <StartForm modes={modes} agents={AGENTS.map((a) => ({ code: a.code, name: a.name }))} templates={TEMPLATES.map((t) => ({ id: t.id, name: t.name, summary: t.summary, participants: t.participants }))} providers={providers} />
          </Card>
          <div>
            <p className="mb-4"><Link href="/council/approvals" className="text-sm font-medium text-electric-600 underline">Approvals{pendingCount > 0 ? ` (${pendingCount} waiting)` : ""}</Link></p>
            <h2 className="text-lg font-semibold text-navy-900">Recent consultations</h2>
            <ul className="mt-3 space-y-3">
              {history.length === 0 && <li className="text-sm text-slate-600">Nothing yet. Your consultations will appear here.</li>}
              {history.map((h) => (
                <li key={h.id}>
                  <Link href={`/council/${h.id}`} className="block rounded-[var(--radius-card)] border border-mist-200 bg-white p-4 shadow-[var(--shadow-card)] hover:border-electric-600">
                    <div className="flex items-center justify-between gap-2"><Badge>{STAGE_LABELS[h.status] ?? h.status}</Badge><time className="text-xs text-slate-500" dateTime={h.createdAt.toISOString()}>{h.createdAt.toISOString().slice(0, 10)}</time></div>
                    <p className="mt-2 line-clamp-3 text-sm text-slate-700">{h.prompt}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>
    </>
  );
}
