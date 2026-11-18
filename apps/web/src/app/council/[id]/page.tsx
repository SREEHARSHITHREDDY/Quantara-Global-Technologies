import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buildReport, parseConsolidated } from "@quantara/council";
import { getExecutionResult, getExecutionView, getPrisma, recordReportAccess } from "@quantara/db";
import { can, canReadCouncilRecord } from "@quantara/rbac";
import { PageHero } from "@/components/site/page-hero";
import { Card, Container } from "@/components/ui/layout";
import { getCouncilCaller } from "@/lib/council-caller";
import { STAGE_LABELS } from "@/lib/council-progress";
import { LiveProgress } from "./live-progress";
import { ReportSections } from "./report-sections";
import { ResultView } from "./result-view";

export const metadata: Metadata = { title: "Consultation", robots: { index: false } };
export const dynamic = "force-dynamic";
const TERMINAL = ["SUCCEEDED", "PARTIALLY_SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT"];
const ID = /^[A-Za-z0-9_-]{8,64}$/;

export default async function ConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await getCouncilCaller();
  if (!caller) redirect("/sign-in");
  if (!ID.test(id)) notFound();
  const db = getPrisma();
  const view = await getExecutionView(db, id, caller.organizationId);
  // Same answer for "missing" and "not yours", so existence is not revealed.
  if (!view || !canReadCouncilRecord(caller.ctx, { ownerId: view.userId, organizationId: view.organizationId }, { userId: caller.userId, organizationId: caller.organizationId })) notFound();
  const done = TERMINAL.includes(view.status);
  const result = done && view.reportReady ? await getExecutionResult(db, id, caller.organizationId) : null;
  // Reading someone else's report (organization-wide history) is recorded.
  if (result != null && view.userId !== caller.userId) await recordReportAccess(db, { organizationId: caller.organizationId, actorId: caller.userId, executionId: id, action: "council.report.viewed", ownerId: view.userId });
  const consolidated = result != null ? parseConsolidated(result) : null;
  const report = consolidated ? buildReport(consolidated, { prompt: view.prompt, mode: view.mode, participants: view.participants, templateId: view.templateId, createdAt: view.createdAt.toISOString() }) : null;
  return (
    <>
      <PageHero eyebrow="Executive Council" title={STAGE_LABELS[view.status] ?? view.status} description={view.prompt.length > 220 ? `${view.prompt.slice(0, 220)}…` : view.prompt} />
      <section className="bg-mist-50 py-12 sm:py-16">
        <Container className="max-w-4xl space-y-6">
          <p><Link href="/council" className="text-sm font-medium text-electric-600 underline">Back to the council</Link></p>
          {!done && <Card><LiveProgress executionId={view.id} initialParticipants={view.participants} /></Card>}
          {done && result != null && <ResultView result={result} />}
          {report && <ReportSections report={report} canExport={can(caller.ctx, "council:report:export")} executionId={view.id} />}
          {done && result == null && (
            <Card>
              <p className="text-slate-700">{view.status === "CANCELLED" ? "This consultation was cancelled." : view.status === "TIMED_OUT" ? "This consultation ran out of time before it finished." : "This consultation did not produce a result."}</p>
              {view.error && <p className="mt-2 text-sm text-slate-500">Reason: {view.error.replace(/_/g, " ")}</p>}
            </Card>
          )}
        </Container>
      </section>
    </>
  );
}
