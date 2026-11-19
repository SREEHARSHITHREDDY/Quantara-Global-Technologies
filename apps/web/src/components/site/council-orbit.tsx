/**
 * Hero artwork: the CEO at the centre and the other executives orbiting it, with signal lines flowing inward.
 * Purely decorative (the real list of executives is on the page), so it is hidden from assistive technology.
 */
export function CouncilOrbit({ codes }: { codes: string[] }) {
  const R = 142;
  const nodes = codes.map((code, i) => {
    const a = (i / codes.length) * Math.PI * 2 - Math.PI / 2;
    return { code, x: 200 + R * Math.cos(a), y: 200 + R * Math.sin(a) };
  });
  return (
    <svg viewBox="0 0 400 400" role="presentation" aria-hidden="true" className="orbit float-y mx-auto h-auto w-full max-w-[26rem] overflow-visible">
      <defs>
        <radialGradient id="orbit-core" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#6b97ff" /><stop offset="100%" stopColor="#1f5eff" /></radialGradient>
        <linearGradient id="orbit-line" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" /><stop offset="100%" stopColor="#3b73ff" stopOpacity="0.5" /></linearGradient>
        <radialGradient id="orbit-glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#3b73ff" stopOpacity="0.45" /><stop offset="100%" stopColor="#3b73ff" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="200" cy="200" r="190" fill="url(#orbit-glow)" />
      <circle cx="200" cy="200" r={R} fill="none" stroke="rgb(255 255 255 / 0.14)" strokeDasharray="2 6" />
      <circle cx="200" cy="200" r="92" fill="none" stroke="rgb(255 255 255 / 0.08)" />
      <g className="orbit-ring">
        {nodes.map((n) => <line key={`l-${n.code}`} className="orbit-line" x1="200" y1="200" x2={n.x} y2={n.y} stroke="url(#orbit-line)" strokeWidth="1.2" />)}
        {nodes.map((n) => (
          <g key={n.code} transform={`translate(${n.x} ${n.y})`}>
            <g className="orbit-node">
              <circle r="21" fill="#0f1f45" stroke="rgb(34 211 238 / 0.7)" strokeWidth="1.2" />
              <text textAnchor="middle" dominantBaseline="central" fontSize="10.5" fontWeight="700" fill="#e8eefc" style={{ fontFamily: "var(--font-display)" }}>{n.code}</text>
            </g>
          </g>
        ))}
      </g>
      <circle className="orbit-halo" cx="200" cy="200" r="36" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
      <circle cx="200" cy="200" r="36" fill="url(#orbit-core)" />
      <text x="200" y="200" textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="800" fill="#fff" style={{ fontFamily: "var(--font-display)" }}>CEO</text>
    </svg>
  );
}
