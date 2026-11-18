import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { APPLICATION_STATUSES, getApplication, getPrisma } from "@quantara/db";
import { can } from "@quantara/rbac";
import { Badge, Card } from "@/components/ui/layout";
import { requireStaff } from "@/lib/admin";
import { updateApplicationStatus } from "../actions";

export const metadata: Metadata = { title: "Application" };
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid gap-1 py-2 sm:grid-cols-[200px_1fr]"><dt className="text-sm text-slate-500">{label}</dt><dd className="whitespace-pre-wrap text-sm text-navy-900">{children || "—"}</dd></div>
);
const when = (d: Date) => `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff("application:read");
  const { id } = await params;
  const a = await getApplication(getPrisma(), id);
  if (!a) notFound();
  return (
    <div className="space-y-5">
      <Link href="/admin/applications" className="text-sm text-electric-600 underline">← All applications</Link>
      <h1 className="text-2xl font-semibold text-navy-900">{a.referenceId} <Badge>{a.status.replace("_", " ").toLowerCase()}</Badge></h1>
      <Card>
        <dl className="divide-y divide-mist-100">
          <Row label="Applicant">{a.applicantName}</Row>
          <Row label="Email"><a className="underline" href={`mailto:${a.applicantEmail}`}>{a.applicantEmail}</a></Row>
          <Row label="Phone">{a.phone}</Row>
          <Row label="Job">{a.job.title}</Row>
          <Row label="Cover letter">{a.coverLetter}</Row>
          <Row label="Resume">{can(s.ctx, "application:resume:download")
            ? <a className="text-electric-600 underline" href={`/admin/applications/${a.id}/resume`}>Download {a.resumeFilename}</a> : `${a.resumeFilename} (you do not have permission to download resumes)`}</Row>
          <Row label="Consent">Given {when(a.consentAt)}</Row>
          <Row label="Received">{when(a.createdAt)}</Row>
        </dl>
      </Card>
      {can(s.ctx, "application:manage") ? (
        <Card>
          <form action={updateApplicationStatus} className="space-y-3">
            <input type="hidden" name="id" value={a.id} />
            <label className="block text-sm text-slate-700">Change status
              <select name="status" defaultValue={a.status} className="mt-1 block rounded-md border border-mist-200 bg-white px-3 py-2">{APPLICATION_STATUSES.map((st) => <option key={st} value={st}>{st.replace("_", " ").toLowerCase()}</option>)}</select></label>
            <label className="block text-sm text-slate-700">Internal note (optional)<textarea name="note" rows={2} maxLength={1000} className="mt-1 block w-full rounded-md border border-mist-200 bg-white px-3 py-2 text-sm" /></label>
            <button type="submit" className="rounded-md bg-navy-900 px-4 py-2 text-sm font-medium text-white">Save</button>
          </form>
        </Card>
      ) : <p className="text-sm text-slate-500">You can view this application but not change its status.</p>}
      <Card>
        <h2 className="text-lg font-semibold text-navy-900">History</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {a.events.map((e: { id: string; createdAt: Date; fromStatus: string | null; toStatus: string; note: string | null }) => <li key={e.id}>{when(e.createdAt)}: {e.fromStatus ? `${e.fromStatus.toLowerCase()} → ` : ""}{e.toStatus.replace("_", " ").toLowerCase()}{e.note ? ` — ${e.note}` : ""}</li>)}
        </ul>
      </Card>
    </div>
  );
}
