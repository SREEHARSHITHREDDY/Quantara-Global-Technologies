"use client";
import { useActionState } from "react";
import { updateSettings, type SettingsState } from "./actions";

export interface Field { key: string; label: string; kind: "text" | "email" | "url" | "textarea"; value: string }

export function SettingsForm({ fields, canWrite }: { fields: Field[]; canWrite: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateSettings, { status: "idle" });
  return (
    <form action={action} className="space-y-4">
      {fields.map((f) => (
        <div key={f.key}>
          <label htmlFor={f.key} className="block text-sm font-medium text-navy-900">{f.label}</label>
          {f.kind === "textarea"
            ? <textarea id={f.key} name={f.key} defaultValue={f.value} disabled={!canWrite} rows={3} className="mt-1 w-full rounded-md border border-mist-200 bg-white px-3 py-2 text-sm" />
            : <input id={f.key} name={f.key} type={f.kind === "text" ? "text" : f.kind} defaultValue={f.value} disabled={!canWrite} className="mt-1 w-full rounded-md border border-mist-200 bg-white px-3 py-2 text-sm" />}
          {state.errors?.[f.key] && <p role="alert" className="mt-1 text-sm text-red-700">{state.errors[f.key]}</p>}
        </div>
      ))}
      {state.message && <p role="status" className={`text-sm ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p>}
      {canWrite && <button type="submit" disabled={pending} className="rounded-md bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{pending ? "Saving…" : "Save settings"}</button>}
    </form>
  );
}
