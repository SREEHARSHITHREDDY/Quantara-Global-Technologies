import { describe, expect, it } from "vitest";
import { buildReport, parseConsolidated, reportToHtml, reportToMarkdown } from "./report";
import { AGENT_CODES, FREE_RATE, MemoryStore, MockProvider, runExecution, type AgentCode } from "./index";

async function consolidated(participants: AgentCode[]) {
  const store = new MemoryStore();
  await runExecution(store.record.id, { participants, rate: FREE_RATE }, { provider: new MockProvider("success"), store });
  return store.result!;
}
const meta = { prompt: "Should we open a Dubai office?", mode: "FULL_COUNCIL", participants: [...AGENT_CODES], templateId: null, createdAt: "2026-11-19T00:00:00Z" };

describe("report", () => {
  it("always has exactly 20 numbered sections in order", async () => {
    const rep = buildReport(await consolidated([...AGENT_CODES]), meta);
    expect(rep.sections.map((s) => s.n)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
  it("marks sections not assessed instead of inventing content, including sustainability and the roadmap", async () => {
    const rep = buildReport(await consolidated(["CEO", "CFO"]), { ...meta, participants: ["CEO", "CFO"] });
    const s = (n: number) => rep.sections.find((x) => x.n === n)!;
    expect(s(6).covered).toBe(false);
    expect(s(6).paragraphs[0]).toMatch(/^Not assessed/);
    expect(s(12).covered).toBe(false);
    expect(s(16).covered).toBe(false);
    expect(s(5).covered).toBe(true);
  });
  it("carries the simulated label into markdown and html, and escapes html", async () => {
    const c = await consolidated([...AGENT_CODES]);
    const rep = buildReport(c, { ...meta, prompt: "<script>alert(1)</script>" });
    expect(rep.simulated).toBe(true);
    expect(reportToMarkdown(rep, c)).toContain("SIMULATED ANALYSIS");
    const html = reportToHtml(rep, c);
    expect(html).toContain("SIMULATED ANALYSIS");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("parseConsolidated accepts real output and rejects junk", async () => {
    const c = await consolidated([...AGENT_CODES]);
    expect(parseConsolidated(JSON.parse(JSON.stringify(c)))).not.toBeNull();
    expect(parseConsolidated({ headline: 1 })).toBeNull();
    expect(parseConsolidated(null)).toBeNull();
  });
});
