"use client";
import { cn } from "@/lib/cn";

/** A card whose border and glow follow the cursor. Touch devices simply get a normal card. */
export function SpotlightCard({ children, className, dark = false }: { children: React.ReactNode; className?: string; dark?: boolean }) {
  return (
    <div
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className={cn("spotlight rounded-[var(--radius-card)] border p-6", dark ? "spotlight-dark border-white/10 bg-white/5 text-mist-100" : "border-mist-200 bg-white shadow-[var(--shadow-card)]", className)}
    >
      <div className="relative">{children}</div>
    </div>
  );
}
