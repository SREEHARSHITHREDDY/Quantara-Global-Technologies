import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@quantara/rbac";
import { ENQUIRY_STATUSES, getEnquiry, getPrisma } from "@quantara/db";
import { Badge, Card } from "@/components/ui/layout";
import { requireStaff } from "@/lib/admin";
import { updateEnquiryStatus } from "../actions";

export const metadata: Metadata = { title: "Enquiry" };

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid gap-1 py-2 sm:grid-cols-[200px_1fr]"><dt className="text-sm text-slate-500">{label}</dt><dd className="whitespace-pre-wrap text-sm text-navy-900">{children || "—"}</dd></div>
);

export default async function EnquiryDetail({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff("enquiry:read");
  const { id } = await params;
  const e = await getEnquiry(getPrisma(), id);
  if (!e) notFound();
  const canManage = can(s.ctx, "enquiry:manage");
  return (
    <div className="space-y-5">
      <Link href="/admin/enquiries" className="text-sm text-electric-600 underline">← All enquiries</Link>
      <h1 className="text-2xl font-semibold text-navy-900">{e.referenceId} <Badge>{e.status.toLowerCase()}</Badge></h1>
      <Card>
        <dl className="divide-y divide-mist-100">
          <Row label="Name">{e.fullName}</Row>
          <Row label="Business email"><a className="underline" href={`mailto:${e.businessEmail}`}>{e.businessEmail}</a></Row>
          <Row label="Organisation">{e.organization}</Row>
          <Row label="Designation">{e.jobDesignation}</Row>
          <Row label="Phone">{e.phone}</Row>
          <Row label="Country">{e.country}</Row>
          <Row label="Service">{e.service?.title}</Row>
          <Row label="Industry">{e.industry?.title}</Row>
          <Row label="Timeline">{e.engagementTimeline}</Row>
          <Row label="Requirements">{e.projectRequirements}</Row>
          <Row label="Additional information">{e.additionalInformation}</Row>
          <Row label="Consent">Given {e.consentAt.toISOString().slice(0, 16).replace("T", " ")} UTC (text version {e.consentTextVersion})</Row>
          <Row label="Spam score">{String(e.spamScore)}</Row>
          <Row label="Received">{e.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</Row>
        </dl>
      </Card>
      {canManage ? (
        <Card>
          <form action={updateEnquiryStatus} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={e.id} />
            <label className="text-sm text-slate-700">Change status
              <select name="status" defaultValue={e.status} className="mt-1 block rounded-md border border-mist-200 bg-white px-3 py-2">
                {ENQUIRY_STATUSES.map((st) => <option key={st} value={st}>{st.toLowerCase()}</option>)}
              </select>
            </label>
            <button type="submit" className="rounded-md bg-navy-900 px-4 py-2 text-sm font-medium text-white">Save</button>
          </form>
        </Card>
      ) : <p className="text-sm text-slate-500">You can view this enquiry but not change its status.</p>}
    </div>
  );
}
