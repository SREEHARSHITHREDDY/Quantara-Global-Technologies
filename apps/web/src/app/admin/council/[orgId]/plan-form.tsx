"use client";
import { useActionState, useState } from "react";
import { updatePlan, type PlanState } from "./actions";

const PLANS = [["DISABLED", "Disabled"], ["TRIAL", "Trial"], ["STANDARD", "Standard"], ["ENTERPRISE", "Enterprise"]] as const;

export function PlanForm({ organizationId, plan, maxConcurrent, canEdit }: { organizationId: string; plan: string; maxConcurrent: number | null; canEdit: boolean }) {
  const [state, action, pending] = useActionState<PlanState, FormData>(updatePlan.bind(null, organizationId), { status: "idle" });
  const [chosen, setChosen] = useState(plan);
  const box = "mt-1 w-full rounded-md border border-mist-200 bg-white px-3 py-2 text-sm";
  return (
    <form action={action} className="space-y-4">
      <div><label htmlFor="plan" className="block text-sm font-medium text-navy-900">Plan</label>
        <select id="plan" name="plan" value={chosen} onChange={(e) => setChosen(e.target.value)} disabled={!canEdit} className={box}>{PLANS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        {state.errors?.plan && <p role="alert" className="mt-1 text-sm text-red-700">{state.errors.plan}</p>}</div>
      {chosen === "TRIAL" && <div><label htmlFor="trialDays" className="block text-sm font-medium text-navy-900">Trial length (days)</label><input id="trialDays" name="trialDays" type="number" min={1} max={90} defaultValue={14} disabled={!canEdit} className={box} />{state.errors?.trialDays && <p role="alert" className="mt-1 text-sm text-red-700">{state.errors.trialDays}</p>}</div>}
      <div><label htmlFor="maxConcurrent" className="block text-sm font-medium text-navy-900">Concurrent runs (blank = plan default)</label><input id="maxConcurrent" name="maxConcurrent" type="number" min={1} max={10} defaultValue={maxConcurrent ?? ""} disabled={!canEdit} className={box} />{state.errors?.maxConcurrent && <p role="alert" className="mt-1 text-sm text-red-700">{state.errors.maxConcurrent}</p>}</div>
      {state.message && <p role="status" className={`text-sm ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p>}
      {canEdit ? <button type="submit" disabled={pending} className="rounded-md bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{pending ? "Saving…" : "Save plan"}</button> : <p className="text-sm text-slate-500">You can view this workspace but not change its plan.</p>}
    </form>
  );
}
