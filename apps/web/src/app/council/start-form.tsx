"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface StartFormProps {
  modes: { id: string; label: string; help: string; allowed: boolean }[];
  agents: { code: string; name: string }[];
  templates: { id: string; name: string; summary: string; participants: string[] }[];
  providers: string[];
}
const input = "mt-1.5 block w-full rounded-lg border border-mist-300 bg-white px-3.5 py-2.5 text-[0.95rem] text-navy-900 focus:border-electric-600 focus:outline-none focus:ring-2 focus:ring-electric-600/30";

export function StartForm({ modes, agents, templates, providers }: StartFormProps) {
  const router = useRouter();
  const firstAllowed = modes.find((m) => m.allowed)?.id ?? "";
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState(firstAllowed);
  const [templateId, setTemplateId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[] | undefined>>({});

  const needsPick = mode === "INDIVIDUAL" || mode === "MULTI_EXECUTIVE";
  const toggle = (c: string) => setPicked((p) => (mode === "INDIVIDUAL" ? [c] : p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setFields({});
    try {
      const body: Record<string, unknown> = { prompt, mode };
      if (templateId) body.templateId = templateId;
      else if (needsPick && picked.length) body.participants = picked;
      if (provider) body.provider = provider;
      const res = await fetch("/api/council/executions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as { executionId?: string; error?: { message?: string; fieldErrors?: Record<string, string[] | undefined> } };
      if (res.status === 202 && json.executionId) { router.push(`/council/${json.executionId}`); return; }
      setError(json.error?.message ?? "Something went wrong. Please try again.");
      setFields(json.error?.fieldErrors ?? {});
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div>
        <label htmlFor="prompt" className="text-sm font-medium text-navy-900">What should the council consider?</label>
        <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={7} maxLength={8000} required className={input}
          aria-invalid={!!fields.prompt} aria-describedby={fields.prompt ? "prompt-err" : undefined}
          placeholder="Describe the decision, the context, your constraints and what a good outcome looks like." />
        <div className="mt-1 flex justify-between text-xs text-slate-500"><span>{fields.prompt && <span id="prompt-err" className="text-red-600">{fields.prompt[0]}</span>}</span><span>{prompt.length} / 8000</span></div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-navy-900">Consultation mode</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {modes.map((m) => (
            <label key={m.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${mode === m.id ? "border-electric-600 bg-electric-600/5" : "border-mist-200 bg-white"} ${m.allowed ? "" : "cursor-not-allowed opacity-50"}`}>
              <input type="radio" name="mode" value={m.id} checked={mode === m.id} disabled={!m.allowed} onChange={() => { setMode(m.id); setPicked([]); }} className="mt-1" />
              <span><span className="font-medium text-navy-900">{m.label}</span><span className="block text-slate-600">{m.help}{m.allowed ? "" : " Not included in your plan."}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="template" className="text-sm font-medium text-navy-900">Template <span className="font-normal text-slate-500">(optional)</span></label>
        <select id="template" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={input}>
          <option value="">No template</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {templateId && <p className="mt-1.5 text-xs text-slate-600">{templates.find((t) => t.id === templateId)?.summary} Executives: {templates.find((t) => t.id === templateId)?.participants.join(", ")}.</p>}
      </div>

      {needsPick && !templateId && (
        <fieldset aria-describedby={fields.participants ? "part-err" : undefined}>
          <legend className="text-sm font-medium text-navy-900">{mode === "INDIVIDUAL" ? "Choose one executive" : "Choose at least two executives"}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {agents.map((a) => (
              <label key={a.code} className="flex cursor-pointer items-center gap-2 rounded-lg border border-mist-200 bg-white px-3 py-2 text-sm">
                <input type={mode === "INDIVIDUAL" ? "radio" : "checkbox"} name="agent" checked={picked.includes(a.code)} onChange={() => toggle(a.code)} />
                <span><span className="font-medium text-navy-900">{a.code}</span> <span className="text-slate-600">{a.name}</span></span>
              </label>
            ))}
          </div>
          {fields.participants && <p id="part-err" className="mt-1 text-xs text-red-600">{fields.participants[0]}</p>}
        </fieldset>
      )}

      {providers.length > 1 && (
        <div>
          <label htmlFor="provider" className="text-sm font-medium text-navy-900">AI provider</label>
          <select id="provider" value={provider} onChange={(e) => setProvider(e.target.value)} className={input}>
            <option value="">Platform default</option>
            {providers.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )}

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <Button type="submit" size="lg" disabled={busy || prompt.trim().length < 10 || !mode}>{busy ? "Starting…" : "Start consultation"}</Button>
    </form>
  );
}
