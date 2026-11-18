import { Badge, Card } from "@/components/ui/layout";

/** The stored result is JSON written by the consolidator. Parse defensively: never trust shape at render time. */
type Rec = Record<string, unknown>;
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter((x): x is Rec => !!x && typeof x === "object") : []);
const s = (v: unknown): string => (typeof v === "string" ? v : "");
const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const pct = (v: unknown) => { const x = n(v); return x === null ? "n/a" : `${Math.round(x * 100)}%`; };

function List({ title, items }: { title: string; items: React.ReactNode[] }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <h3 className="text-base font-semibold text-navy-900">{title}</h3>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </Card>
  );
}

export function ResultView({ result }: { result: unknown }) {
  const r = (result && typeof result === "object" ? result : {}) as Rec;
  const label = s(r.label) || "AI-GENERATED ANALYSIS";
  const simulated = r.simulated === true;
  const agents = arr(r.agents), disagreements = arr(r.disagreements), risks = arr(r.risks), claims = arr(r.claims);
  const missing = arr(r.missingInformation), assumptions = arr(r.assumptions), approvals = arr(r.approvalsRequired);
  const failed = arr(r.failedAgents), skipped = arr(r.skippedAgents);
  const caveats = Array.isArray(r.caveats) ? r.caveats.filter((x): x is string => typeof x === "string") : [];
  return (
    <div className="space-y-6">
      <div role="note" className={`rounded-lg border px-4 py-3 text-sm font-semibold ${simulated ? "border-amber-300 bg-amber-50 text-amber-900" : "border-mist-300 bg-mist-100 text-navy-900"}`}>
        {label}{simulated ? ": test output, not real analysis." : ": advisory only. Verify before acting."}
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{r.consensus === true ? "Consensus" : "No consensus"}</Badge>
          <Badge>Overall confidence {pct(r.overallConfidence)}</Badge>
        </div>
        <h2 className="mt-3 text-xl font-semibold text-navy-900">{s(r.headline) || "No headline available."}</h2>
      </Card>

      {disagreements.length > 0 && (
        <Card className="border-amber-200">
          <h3 className="text-base font-semibold text-navy-900">Where the executives disagree</h3>
          <div className="mt-3 space-y-4">
            {disagreements.map((d, i) => (
              <div key={i} className="text-sm">
                <p className="font-medium text-navy-900">{s(d.topic)}</p>
                <ul className="mt-1 space-y-1 text-slate-700">{arr(d.positions).map((pos, j) => <li key={j}><span className="font-medium">{s(pos.agent)}:</span> {s(pos.recommendation)}</li>)}</ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="text-base font-semibold text-navy-900">Executive assessments</h3>
        <ul className="mt-3 divide-y divide-mist-100">
          {agents.length === 0 && <li className="py-2 text-sm text-slate-600">No assessments completed.</li>}
          {agents.map((a, i) => (
            <li key={i} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-navy-900">{s(a.agent)}</span><Badge>{s(a.stance)}</Badge><span className="text-slate-500">confidence {pct(a.confidence)}</span></div>
              <p className="mt-1 text-slate-700">{s(a.recommendation)}</p>
            </li>
          ))}
        </ul>
      </Card>

      <List title="Risks" items={risks.map((x) => <span key={s(x.description)}><strong>{s(x.severity)}</strong> ({s(x.agent)}): {s(x.description)}</span>)} />
      <List title="Missing information" items={missing.map((x) => `${s(x.agent)}: ${s(x.item)}`)} />
      <List title="Assumptions" items={assumptions.map((x) => `${s(x.agent)}: ${s(x.item)}`)} />
      <List title="Approvals required before acting" items={approvals.map((x) => `${s(x.agent)}: ${s(x.action)} (${s(x.reason)})`)} />
      <List title="Claims and their evidence status" items={claims.map((c) => <span key={s(c.claim)}>{s(c.claim)} <Badge>{s(c.label)}</Badge>{s(c.source) ? ` Source: ${s(c.source)}` : ""}</span>)} />
      <List title="Assessments that did not complete" items={[...failed.map((x) => `${s(x.agent)} failed: ${s(x.reason)}`), ...skipped.map((x) => `${s(x.agent)} skipped: ${s(x.reason)}`)]} />
      <List title="Caveats" items={caveats} />
      <p className="text-xs text-slate-500">This output supports a decision. It is not legal, financial or other professional advice.</p>
    </div>
  );
}
