"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DecisionButtons({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/council/approvals/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision, ...(note.trim() ? { note: note.trim() } : {}) }) });
      if (res.ok) { router.refresh(); return; }
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      setError(j.error?.message ?? "Something went wrong. Please try again.");
      if (res.status === 409 || res.status === 410) router.refresh();
    } catch { setError("We could not reach the server."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-3 space-y-2">
      <label htmlFor={`note-${id}`} className="sr-only">Decision note</label>
      <input id={`note-${id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Note (required if you reject)" className="block w-full rounded-lg border border-mist-300 bg-white px-3 py-2 text-sm text-navy-900 focus:border-electric-600 focus:outline-none focus:ring-2 focus:ring-electric-600/30" />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => decide("APPROVED")} disabled={busy}>Approve</Button>
        <Button size="sm" variant="outline" onClick={() => decide("REJECTED")} disabled={busy}>Reject</Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
