/**
 * A small, safe formatter for article bodies. It understands only: ## and ### headings, paragraphs,
 * "- " bullet lists, "1. " numbered lists, "> " quotes, **bold**, and [text](https://link).
 * It produces plain data (never HTML), so article text can never inject markup or scripts.
 */
export type Inline = { type: "text"; text: string } | { type: "bold"; text: string } | { type: "link"; text: string; href: string };
export type Block =
  | { type: "h2"; inline: Inline[] } | { type: "h3"; inline: Inline[] } | { type: "p"; inline: Inline[] } | { type: "quote"; inline: Inline[] }
  | { type: "ul"; items: Inline[][] } | { type: "ol"; items: Inline[][] };

const INLINE = /\*\*([^*]+)\*\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []; let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ type: "text", text: text.slice(last, i) });
    if (m[1] !== undefined) out.push({ type: "bold", text: m[1] });
    else out.push({ type: "link", text: m[2]!, href: m[3]! });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = []; let para: string[] = []; let list: { type: "ul" | "ol"; items: Inline[][] } | null = null;
  const flushPara = () => { if (para.length) { blocks.push({ type: "p", inline: parseInline(para.join(" ")) }); para = []; } };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };
  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    let m: RegExpExecArray | null;
    if ((m = /^(#{2,3})\s+(.+)$/.exec(line))) { flushPara(); flushList(); blocks.push({ type: m[1]!.length === 2 ? "h2" : "h3", inline: parseInline(m[2]!) }); }
    else if ((m = /^[-*]\s+(.+)$/.exec(line))) { flushPara(); if (list?.type !== "ul") { flushList(); list = { type: "ul", items: [] }; } list.items.push(parseInline(m[1]!)); }
    else if ((m = /^\d+[.)]\s+(.+)$/.exec(line))) { flushPara(); if (list?.type !== "ol") { flushList(); list = { type: "ol", items: [] }; } list.items.push(parseInline(m[1]!)); }
    else if ((m = /^>\s?(.+)$/.exec(line))) { flushPara(); flushList(); blocks.push({ type: "quote", inline: parseInline(m[1]!) }); }
    else { flushList(); para.push(line); }
  }
  flushPara(); flushList();
  return blocks;
}

export const readingMinutes = (text: string): number => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 200));
