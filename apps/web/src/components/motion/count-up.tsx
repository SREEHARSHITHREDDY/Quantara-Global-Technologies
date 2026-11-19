"use client";
import { animate, useInView } from "motion/react";
import { useEffect, useRef } from "react";

/** Counts up to `value` when scrolled into view. The final number is in the server HTML, so it is correct without JavaScript. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  useEffect(() => {
    if (!inView || !ref.current) return;
    const el = ref.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = animate(0, value, { duration: 1.4, ease: [0.25, 1, 0.5, 1], onUpdate: (v) => { el.textContent = String(Math.round(v)); } });
    return () => c.stop();
  }, [inView, value]);
  return <span ref={ref} className={className}>{value}</span>;
}
