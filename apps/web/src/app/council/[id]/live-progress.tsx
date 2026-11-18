"use client";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { applyEvent, initialProgress, STAGE_LABELS, type CouncilEventLike, type Progress } from "@/lib/council-progress";

const EVENT_TYPES = ["state.changed", "participants.selected", "agent.started", "agent.completed", "agent.failed", "agent.skipped", "disagreement.detected", "consolidation.completed"];
const AGENT_STATE: Record<string, string> = { waiting: "Waiting", working: "Working…", done: "Done", failed: "Failed", skipped: "Skipped" };

export function LiveProgress({ executionId, initialParticipants }: { executionId: string; initialParticipants: string[] }) {
  const router = useRouter();
  const [p, dispatch] = useReducer((s: Progress, e: CouncilEventLike) => applyEvent(s, e), undefined, () => applyEvent(initialProgress(), { seq: 0.5, type: "participants.selected", data: { participants: initialParticipants } }));
  const [lost, setLost] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const lastSeq = useRef(0);
  lastSeq.current = Math.max(lastSeq.current, p.lastSeq);

  useEffect(() => {
    const es = new EventSource(`/api/council/executions/${executionId}/events`);
    const onEvent = (ev: MessageEvent) => { try { setLost(false); dispatch(JSON.parse(ev.data as string) as CouncilEventLike); } catch { /* ignore a malformed frame */ } };
    for (const t of EVENT_TYPES) es.addEventListener(t, onEvent as EventListener);
    es.addEventListener("end", (ev) => {
      let data: Record<string, unknown> = {};
      try { data = JSON.parse((ev as MessageEvent).data as string) as Record<string, unknown>; } catch { /* keep empty */ }
      dispatch({ seq: lastSeq.current + 1, type: "end", data });
      es.close();
      router.refresh();
    });
    es.onerror = () => setLost(true);   // EventSource reconnects by itself and resumes from Last-Event-ID
    return () => es.close();
  }, [executionId, router]);

  async function cancel() {
    setCancelling(true); setCancelError(null);
    try {
      const res = await fetch(`/api/council/executions/${executionId}/cancel`, { method: "POST" });
      if (!res.ok) setCancelError("We could not cancel this consultation. Please try again.");
    } catch { setCancelError("We could not reach the server."); }
    finally { setCancelling(false); }
  }

  const names = p.participants.length ? p.participants : Object.keys(p.agents);
  return (
    <div className="space-y-5" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold text-navy-900">{p.ended ? "Finishing up…" : STAGE_LABELS[p.stage ?? "QUEUED"] ?? p.stage}</p>
        {!p.ended && <Button variant="outline" size="sm" onClick={cancel} disabled={cancelling}>{cancelling ? "Cancelling…" : "Cancel"}</Button>}
      </div>
      {lost && !p.ended && <p className="text-sm text-slate-600">Connection interrupted. Reconnecting…</p>}
      {cancelError && <p role="alert" className="text-sm text-red-600">{cancelError}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {names.map((a) => {
          const s = p.agents[a] ?? { state: "waiting" as const };
          return (
            <li key={a} className="rounded-lg border border-mist-200 bg-white p-3 text-sm">
              <div className="flex justify-between"><span className="font-medium text-navy-900">{a}</span><span className={s.state === "failed" ? "text-red-600" : "text-slate-600"}>{AGENT_STATE[s.state]}</span></div>
              {s.state === "done" && <p className="mt-1 text-slate-600">{s.stance}{typeof s.confidence === "number" ? `, confidence ${Math.round(s.confidence * 100)}%` : ""}</p>}
              {(s.state === "failed" || s.state === "skipped") && s.reason && <p className="mt-1 text-slate-600">{s.reason}</p>}
            </li>
          );
        })}
      </ul>
      {p.disagreements.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Disagreement detected</p>
          <ul className="mt-1 list-disc pl-5">{p.disagreements.map((d, i) => <li key={i}>{d.topic}{d.agents.length ? ` (${d.agents.join(" vs ")})` : ""}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
