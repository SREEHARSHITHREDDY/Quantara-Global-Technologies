import { describe, expect, it } from "vitest";
import { encodeEvent, parseAfter, streamExecution, type EventRow, type EventSource } from "./council-events";

const row = (seq: number, type = "agent.completed", agent: string | null = "CFO", payload: unknown = { stance: "support" }): EventRow => ({ seq, type, agent, payload, createdAt: new Date("2026-11-18T10:00:00Z") });

/** A fake execution whose events and status change as the stream polls it. */
function fake(script: { status: string; events: EventRow[] }[]) {
  let step = 0; const reads: number[] = [];
  const cur = () => script[Math.min(step, script.length - 1)]!;
  const src: EventSource = {
    status: async () => cur().status,
    events: async (after) => { reads.push(after); const r = cur().events.filter((e) => e.seq > after); return r; },
  };
  return { src, advance: () => { step++; }, reads };
}
async function collect(gen: AsyncGenerator<string>, advance?: () => void, max = 200) {
  const out: string[] = []; let n = 0;
  for await (const f of gen) { out.push(f); if (++n > max) throw new Error("stream did not end"); advance?.(); }
  return out;
}
const sleep = async () => {};
const ids = (frames: string[]) => frames.filter((f) => f.startsWith("id:")).map((f) => Number(f.split("\n")[0]!.slice(4)));

describe("event encoding", () => {
  it("writes id, event name and JSON data, and sanitises the event name", () => {
    const f = encodeEvent(row(7, "agent.completed"));
    expect(f).toBe(`id: 7\nevent: agent.completed\ndata: ${JSON.stringify({ seq: 7, type: "agent.completed", agent: "CFO", at: "2026-11-18T10:00:00.000Z", data: { stance: "support" } })}\n\n`);
    expect(encodeEvent(row(1, "bad\nname: x"))).not.toContain("name: x\nid");
    expect(encodeEvent(row(2, "x", null, null))).not.toContain('"data"');
  });
  it("parses Last-Event-ID and ?after= defensively", () => {
    expect(parseAfter("12", null)).toBe(12); expect(parseAfter(null, "5")).toBe(5);
    for (const bad of ["abc", "-3", "1.5", "99999999999", "", "NaN"]) expect(parseAfter(bad, null)).toBe(0);
    expect(parseAfter(null, null)).toBe(0);
  });
});

describe("streamExecution", () => {
  it("replays everything from the start, then ends with the final status once the run is finished", async () => {
    const { src } = fake([{ status: "SUCCEEDED", events: [row(1), row(2), row(3, "state.changed", null)] }]);
    const frames = await collect(streamExecution(src, { afterSeq: 0, sleep }));
    expect(ids(frames)).toEqual([1, 2, 3]);
    expect(frames.at(-1)).toBe(`event: end\ndata: ${JSON.stringify({ status: "SUCCEEDED" })}\n\n`);
  });
  it("resumes after Last-Event-ID without repeating or skipping events", async () => {
    const { src } = fake([{ status: "SUCCEEDED", events: [row(1), row(2), row(3), row(4)] }]);
    expect(ids(await collect(streamExecution(src, { afterSeq: 2, sleep })))).toEqual([3, 4]);
  });
  it("delivers events that arrive later, in order, while the run is active", async () => {
    const { src, advance } = fake([
      { status: "ASSESSING", events: [row(1)] },
      { status: "ASSESSING", events: [row(1), row(2), row(3)] },
      { status: "SUCCEEDED", events: [row(1), row(2), row(3), row(4, "state.changed", null)] },
    ]);
    const frames = await collect(streamExecution(src, { afterSeq: 0, sleep }), advance);
    expect(ids(frames)).toEqual([1, 2, 3, 4]);
  });
  it("does not end early when the status turns final just before the last event is written", async () => {
    const { src, advance } = fake([
      { status: "ASSESSING", events: [row(1)] },
      { status: "SUCCEEDED", events: [row(1)] },                                   // status changed, last event not yet written
      { status: "SUCCEEDED", events: [row(1), row(2, "state.changed", null)] },    // appears during the grace wait
    ]);
    let slept = 0;
    const frames = await collect(streamExecution(src, { afterSeq: 0, sleep: async () => { slept++; advance(); } }), advance);
    expect(ids(frames)).toEqual([1, 2]);
    expect(slept).toBeGreaterThan(0);
  });
  it("sends a keep-alive comment while idle", async () => {
    let t = 0;
    const { src, advance } = fake([{ status: "ASSESSING", events: [] }, { status: "ASSESSING", events: [] }, { status: "FAILED", events: [] }]);
    const frames = await collect(streamExecution(src, { afterSeq: 0, heartbeatMs: 10, pollMs: 1, now: () => t, sleep: async () => { t += 20; advance(); } }));
    expect(frames.filter((f) => f.includes("keep-alive")).length).toBeGreaterThan(0);
  });
  it("stops when the client disconnects", async () => {
    const c = new AbortController();
    const { src } = fake([{ status: "ASSESSING", events: [] }]);
    const frames: string[] = [];
    for await (const f of streamExecution(src, { afterSeq: 0, signal: c.signal, sleep: async () => { c.abort(); } })) frames.push(f);
    expect(frames).toEqual([": connected\n\n"]);
  });
  it("ends with not_found if the execution disappears, and with max_duration if it runs too long", async () => {
    const gone: EventSource = { status: async () => null, events: async () => [] };
    expect((await collect(streamExecution(gone, { afterSeq: 0, sleep }))).at(-1)).toContain("not_found");
    let t = 0; const { src } = fake([{ status: "ASSESSING", events: [] }]);
    const frames = await collect(streamExecution(src, { afterSeq: 0, maxMs: 50, now: () => t, sleep: async () => { t += 30; } }));
    expect(frames.at(-1)).toContain("max_duration");
  });
});
