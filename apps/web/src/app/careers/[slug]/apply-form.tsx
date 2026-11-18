"use client";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { APPLICATION_CONSENT_TEXT } from "@/lib/validation/application";
import type { ApplicationState } from "@/server/application-service";
import { submitApplication } from "../actions";

const input = "mt-1.5 block w-full rounded-lg border border-mist-300 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink shadow-sm focus:border-electric-500 focus:outline-none focus:ring-2 focus:ring-electric-500/30 aria-[invalid=true]:border-red-500";

function Field({ name, label, required, hint, errors, children }: { name: string; label: string; required?: boolean; hint?: string; errors?: string[] | undefined; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium text-navy-900">{label}{required && <span className="text-red-600"> *</span>}</label>
      {children}
      {hint && !errors && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {errors && <p id={`${name}-error`} role="alert" className="mt-1 text-sm text-red-600">{errors[0]}</p>}
    </div>
  );
}

export function ApplyForm({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState<ApplicationState, FormData>(submitApplication, { status: "idle" });
  const [startedAt, setStartedAt] = useState("");
  useEffect(() => setStartedAt(String(Date.now())), []);
  if (state.status === "success") {
    return (
      <div role="status" className="rounded-[var(--radius-card)] border border-mist-200 bg-mist-50 p-8">
        <h3 className="text-xl font-semibold text-navy-900">{state.duplicate ? "We already have your application." : "Thank you. Your application has been received."}</h3>
        <p className="mt-3 text-slate-600">Your reference number is</p>
        <p className="mt-1 font-display text-2xl font-semibold text-electric-600">{state.referenceId}</p>
        <p className="mt-4 text-sm text-slate-600">Our team will review your application and contact you if there is a match.</p>
      </div>
    );
  }
  const fe = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const a = (n: string) => ({ id: n, name: n, "aria-invalid": fe[n] ? true : undefined, "aria-describedby": fe[n] ? `${n}-error` : undefined }) as const;
  return (
    <form action={action} noValidate className="space-y-6">
      {state.status === "error" && state.message && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.message}</p>}
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="startedAt" value={startedAt} />
      <div className="grid gap-6 sm:grid-cols-2">
        <Field name="applicantName" label="Full name" required errors={fe.applicantName}><input {...a("applicantName")} className={input} autoComplete="name" required /></Field>
        <Field name="applicantEmail" label="Email" required errors={fe.applicantEmail}><input {...a("applicantEmail")} type="email" className={input} autoComplete="email" required /></Field>
        <Field name="phone" label="Phone" errors={fe.phone}><input {...a("phone")} type="tel" className={input} autoComplete="tel" /></Field>
        <Field name="resume" label="Resume" required hint="PDF or Word, up to 5 MB." errors={fe.resume}><input {...a("resume")} type="file" accept=".pdf,.doc,.docx,application/pdf" className={input} required /></Field>
      </div>
      <Field name="coverLetter" label="Cover letter" hint="Optional." errors={fe.coverLetter}><textarea {...a("coverLetter")} rows={5} className={input} /></Field>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" name="privacyConsent" id="privacyConsent" className="mt-1 h-4 w-4 rounded border-mist-300 text-electric-600" aria-invalid={fe.privacyConsent ? true : undefined} />
          <span>{APPLICATION_CONSENT_TEXT}</span>
        </label>
        {fe.privacyConsent && <p role="alert" className="mt-1 text-sm text-red-600">{fe.privacyConsent[0]}</p>}
      </div>
      <Button type="submit" size="lg" disabled={pending || startedAt === ""}>{pending ? "Sending..." : "Submit application"}</Button>
    </form>
  );
}
