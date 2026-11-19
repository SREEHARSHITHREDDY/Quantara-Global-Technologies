import Link from "next/link";

/** A slowly scrolling row of links. Each half repeats so the loop has no gap; the repeats are hidden from assistive technology and the tab order. */
export function Marquee({ items, reverse = false, speed = 50 }: { items: { href: string; label: string }[]; reverse?: boolean; speed?: number }) {
  const copies = 4;
  const half = Array.from({ length: copies }, (_, c) => c);
  const track = (dup: boolean) => half.map((c) => items.map((i) => (
    <Link key={`${dup}-${c}-${i.href}`} href={i.href} tabIndex={c === 0 && !dup ? undefined : -1} aria-hidden={c === 0 && !dup ? undefined : true}
      {...(c === 0 && !dup ? {} : { "data-dup": "" })}
      className="whitespace-nowrap rounded-full border border-mist-200 bg-white px-5 py-2.5 text-sm font-medium text-navy-800 shadow-sm transition-colors hover:border-electric-500 hover:text-electric-600">{i.label}</Link>
  )));
  return (
    <div className={`marquee ${reverse ? "marquee-reverse" : ""}`} style={{ "--marquee-speed": `${speed}s` } as React.CSSProperties}>
      <div className="marquee-track">{track(false)}{track(true)}</div>
    </div>
  );
}
