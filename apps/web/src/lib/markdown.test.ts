import { describe, expect, it } from "vitest";
import { parseBlocks, parseInline, readingMinutes } from "./markdown";

describe("parseBlocks", () => {
  it("parses headings, paragraphs, lists and quotes", () => {
    const b = parseBlocks("## Title\n\nFirst line\nsecond line\n\n- a\n- b\n\n1. one\n2) two\n\n> quoted\n### Sub");
    expect(b.map((x) => x.type)).toEqual(["h2", "p", "ul", "ol", "quote", "h3"]);
    expect(b[1]).toMatchObject({ type: "p", inline: [{ type: "text", text: "First line second line" }] });
    expect((b[2] as { items: unknown[] }).items).toHaveLength(2); expect((b[3] as { items: unknown[] }).items).toHaveLength(2);
  });
  it("handles Windows line endings and empty input", () => {
    expect(parseBlocks("a\r\n\r\nb").map((x) => x.type)).toEqual(["p", "p"]); expect(parseBlocks("")).toEqual([]);
  });
});
describe("parseInline", () => {
  it("finds bold text and https links", () => {
    expect(parseInline("Hi **there** see [docs](https://example.com/a?b=1) now")).toEqual([
      { type: "text", text: "Hi " }, { type: "bold", text: "there" }, { type: "text", text: " see " },
      { type: "link", text: "docs", href: "https://example.com/a?b=1" }, { type: "text", text: " now" }]);
  });
  it("never turns scripts or javascript: links into markup; they stay plain text", () => {
    const r = parseInline("<script>alert(1)</script> [x](javascript:alert(1)) [y](data:text/html,hi)");
    expect(r.every((p) => p.type === "text")).toBe(true);
    expect(r.map((p) => (p as { text: string }).text).join("")).toContain("<script>");
  });
});
describe("readingMinutes", () => { it("is at least 1 and scales with length", () => { expect(readingMinutes("a b c")).toBe(1); expect(readingMinutes("word ".repeat(1000))).toBe(5); }); });
