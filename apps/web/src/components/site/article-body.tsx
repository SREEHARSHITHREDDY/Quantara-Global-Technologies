import { parseBlocks, type Inline } from "@/lib/markdown";

function Inlines({ parts }: { parts: Inline[] }) {
  return <>{parts.map((p, i) => p.type === "bold" ? <strong key={i}>{p.text}</strong>
    : p.type === "link" ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer nofollow" className="text-electric-600 underline">{p.text}</a>
    : <span key={i}>{p.text}</span>)}</>;
}

/** Renders article text from parsed data. No HTML is ever inserted from the article. */
export function ArticleBody({ text }: { text: string }) {
  return (
    <div className="space-y-5 text-[1.05rem] leading-relaxed text-slate-700">
      {parseBlocks(text).map((b, i) => {
        if (b.type === "ul" || b.type === "ol") {
          const Tag = b.type;
          return <Tag key={i} className={b.type === "ul" ? "list-disc space-y-1.5 pl-6" : "list-decimal space-y-1.5 pl-6"}>{b.items.map((it, j) => <li key={j}><Inlines parts={it} /></li>)}</Tag>;
        }
        if (b.type === "h2") return <h2 key={i} className="pt-4 text-2xl font-semibold text-navy-900"><Inlines parts={b.inline} /></h2>;
        if (b.type === "h3") return <h3 key={i} className="pt-2 text-xl font-semibold text-navy-900"><Inlines parts={b.inline} /></h3>;
        if (b.type === "quote") return <blockquote key={i} className="border-l-4 border-electric-500 pl-4 italic"><Inlines parts={b.inline} /></blockquote>;
        return <p key={i}><Inlines parts={b.inline} /></p>;
      })}
    </div>
  );
}
