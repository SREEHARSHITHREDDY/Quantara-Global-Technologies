/** Splits a headline into words that rise into place one after another. Pure CSS, so it never waits for JavaScript. */
export function HeroHeading({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <h1 className={className}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`}>
          <span className="word-mask"><span className="word-rise" style={{ "--i": i } as React.CSSProperties}>{w}</span></span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </h1>
  );
}
