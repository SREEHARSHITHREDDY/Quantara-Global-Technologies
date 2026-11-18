"use client";
import { useActionState } from "react";
import { saveJobAction, type JobFormState } from "./actions";

export interface JobDefaults { id?: string; title: string; slug: string; department: string; employmentType: string; location: string; description: string; responsibilities: string; requirements: string; status: string; closesAt: string }
const box = "mt-1 w-full rounded-md border border-mist-200 bg-white px-3 py-2 text-sm aria-[invalid=true]:border-red-500";

export function JobForm({ defaults, canPublish, types, statuses }: { defaults: JobDefaults; canPublish: boolean; types: { value: string; label: string }[]; statuses: string[] }) {
  const [state, action, pending] = useActionState<JobFormState, FormData>(saveJobAction, { status: "idle" });
  const fe = state.fieldErrors ?? {};
  const f = (name: string, label: string, el: React.ReactNode, hint?: string) => (
    <div><label htmlFor={name} className="block text-sm font-medium text-navy-900">{label}</label>{el}
      {hint && !fe[name] && <p className="mt-1 text-xs text-slate-500">{hint}</p>}{fe[name] && <p role="alert" className="mt-1 text-sm text-red-700">{fe[name]}</p>}</div>
  );
  const common = (n: string) => ({ id: n, name: n, "aria-invalid": fe[n] ? true : undefined }) as const;
  return (
    <form action={action} className="space-y-4">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      {f("title", "Job title", <input {...common("title")} defaultValue={defaults.title} className={box} />)}
      {f("slug", "URL slug", <input {...common("slug")} defaultValue={defaults.slug} className={box} />, "Leave empty to create it from the title. Changing it changes the public address.")}
      <div className="grid gap-4 sm:grid-cols-2">
        {f("department", "Department", <input {...common("department")} defaultValue={defaults.department} className={box} />)}
        {f("location", "Location", <input {...common("location")} defaultValue={defaults.location} className={box} />)}
        {f("employmentType", "Employment type", <select {...common("employmentType")} defaultValue={defaults.employmentType} className={box}>{types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>)}
        {f("closesAt", "Closing date", <input {...common("closesAt")} type="date" defaultValue={defaults.closesAt} className={box} />, "Optional. The job disappears from the site after this date.")}
      </div>
      {f("description", "Description", <textarea {...common("description")} rows={6} defaultValue={defaults.description} className={box} />)}
      {f("responsibilities", "Responsibilities", <textarea {...common("responsibilities")} rows={5} defaultValue={defaults.responsibilities} className={box} />, "One per line.")}
      {f("requirements", "Requirements", <textarea {...common("requirements")} rows={5} defaultValue={defaults.requirements} className={box} />, "One per line.")}
      {f("status", "Status", <select {...common("status")} defaultValue={defaults.status} className={box}>{statuses.map((s) => <option key={s} value={s} disabled={s === "PUBLISHED" && !canPublish && defaults.status !== "PUBLISHED"}>{s.toLowerCase()}</option>)}</select>, canPublish ? "Only published jobs appear on the website." : "You can save drafts. Publishing needs the job:publish permission.")}
      {state.message && <p role="status" className={`text-sm ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p>}
      <button type="submit" disabled={pending} className="rounded-md bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{pending ? "Saving…" : "Save job"}</button>
    </form>
  );
}
