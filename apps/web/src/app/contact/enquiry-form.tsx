"use client";
import { useActionState, useEffect, useState } from "react";
import { industries, services } from "@quantara/content";
import { Button } from "@/components/ui/button";
import { CONSENT_TEXT, TIMELINES } from "@/lib/validation/enquiry";
import type { EnquiryState } from "@/server/enquiry-service";
import { submitEnquiry } from "./actions";

const input = "mt-1.5 block w-full rounded-lg border border-mist-300 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink shadow-sm placeholder:text-slate-400 focus:border-electric-500 focus:outline-none focus:ring-2 focus:ring-electric-500/30 aria-[invalid=true]:border-red-500";

function Field({ name, label, required, hint, errors, children }: { name: string; label: string; required?: boolean; hint?: string; errors?: string[] | undefined; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium text-navy-900">{label}{required && <span className="text-red-600"> *</span>}</label>
      {children}
      {hint && !errors && <p id={`${name}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}
      {errors && <p id={`${name}-error`} role="alert" className="mt-1 text-sm text-red-600">{errors[0]}</p>}
    </div>
  );
}

export function EnquiryForm() {
  const [state, action, pending] = useActionState<EnquiryState, FormData>(submitEnquiry, { status: "idle" });
  // Generated in the browser: the page is statically rendered, so a server-made key would be shared by every visitor.
  const [meta, setMeta] = useState({ key: "", startedAt: "" });
  useEffect(() => setMeta({ key: crypto.randomUUID(), startedAt: String(Date.now()) }), []);

  if (state.status === "success") {
    return (
      <div role="status" className="rounded-[var(--radius-card)] border border-mist-200 bg-mist-50 p-8">
        <h2 className="text-2xl font-semibold text-navy-900">Thank you. Your enquiry has been received.</h2>
        <p className="mt-3 text-slate-600">Your reference number is</p>
        <p className="mt-1 font-display text-2xl font-semibold text-electric-600">{state.referenceId}</p>
        <p className="mt-4 text-sm text-slate-600">Please keep this reference for your records. Our team will review your enquiry and respond to the email address you provided.</p>
      </div>
    );
  }
  const fe = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const a = (n: string) => ({ id: n, name: n, "aria-invalid": fe[n] ? true : undefined, "aria-describedby": fe[n] ? `${n}-error` : undefined }) as const;
  return (
    <form action={action} noValidate className="space-y-6">
      {state.status === "error" && state.message && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.message}</p>}
      <div className="grid gap-6 sm:grid-cols-2">
        <Field name="fullName" label="Full name" required errors={fe.fullName}><input {...a("fullName")} className={input} autoComplete="name" required /></Field>
        <Field name="businessEmail" label="Business email" required errors={fe.businessEmail}><input {...a("businessEmail")} type="email" className={input} autoComplete="email" required /></Field>
        <Field name="organization" label="Organization" required errors={fe.organization}><input {...a("organization")} className={input} autoComplete="organization" required /></Field>
        <Field name="jobDesignation" label="Job designation" required errors={fe.jobDesignation}><input {...a("jobDesignation")} className={input} autoComplete="organization-title" required /></Field>
        <Field name="phone" label="Phone" errors={fe.phone}><input {...a("phone")} type="tel" className={input} autoComplete="tel" /></Field>
        <Field name="country" label="Country" required errors={fe.country}><input {...a("country")} className={input} autoComplete="country-name" required /></Field>
        <Field name="serviceSlug" label="Service of interest" errors={fe.serviceSlug}>
          <select {...a("serviceSlug")} className={input} defaultValue=""><option value="">Not sure yet</option>{services.map((s) => <option key={s.slug} value={s.slug}>{s.title}</option>)}</select>
        </Field>
        <Field name="industrySlug" label="Industry" errors={fe.industrySlug}>
          <select {...a("industrySlug")} className={input} defaultValue=""><option value="">Not listed</option>{industries.map((i) => <option key={i.slug} value={i.slug}>{i.title}</option>)}</select>
        </Field>
      </div>
      <Field name="projectRequirements" label="Project requirements" required hint="At least 20 characters. Describe your objectives and context." errors={fe.projectRequirements}>
        <textarea {...a("projectRequirements")} rows={6} className={input} required />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field name="engagementTimeline" label="Engagement timeline" errors={fe.engagementTimeline}>
          <select {...a("engagementTimeline")} className={input} defaultValue=""><option value="">Select</option>{TIMELINES.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field name="additionalInformation" label="Additional information" errors={fe.additionalInformation}><input {...a("additionalInformation")} className={input} /></Field>
      </div>
      {/* Honeypot: hidden from people and assistive technology; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <input type="hidden" name="idempotencyKey" value={meta.key} />
      <input type="hidden" name="startedAt" value={meta.startedAt} />
      <div>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" name="privacyConsent" id="privacyConsent" className="mt-1 h-4 w-4 rounded border-mist-300 text-electric-600" aria-invalid={fe.privacyConsent ? true : undefined} aria-describedby={fe.privacyConsent ? "privacyConsent-error" : undefined} />
          <span>{CONSENT_TEXT}</span>
        </label>
        {fe.privacyConsent && <p id="privacyConsent-error" role="alert" className="mt-1 text-sm text-red-600">{fe.privacyConsent[0]}</p>}
      </div>
      <Button type="submit" size="lg" disabled={pending || meta.key === ""}>{pending ? "Sending..." : "Send enquiry"}</Button>
    </form>
  );
}
