import * as React from "react";
import { cn } from "@/lib/cn";
import { Reveal } from "@/components/motion/reveal";

export const Container = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12", className)} {...p} />;

export function Section({ tone = "light", className, children, ...p }: React.HTMLAttributes<HTMLElement> & { tone?: "light" | "mist" | "dark" }) {
  return (
    <section className={cn("py-20 sm:py-28", tone === "light" && "bg-white", tone === "mist" && "bg-mist-50 bg-dots", tone === "dark" && "bg-hero text-white", className)} {...p}>
      <Container>{children}</Container>
    </section>
  );
}

export const Eyebrow = ({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) => <p className={cn("text-xs font-semibold uppercase tracking-[0.18em] text-electric-600", className)} {...p} />;

export function SectionHeading({ eyebrow, title, description, tone = "light", className }: { eyebrow?: string; title: string; description?: string; tone?: "light" | "dark"; className?: string }) {
  return (
    <Reveal className={cn("max-w-3xl", className)}>
      {eyebrow && <Eyebrow className={tone === "dark" ? "text-cyan-400" : undefined}>{eyebrow}</Eyebrow>}
      <h2 className={cn("mt-3 text-3xl font-semibold sm:text-4xl lg:text-5xl", tone === "dark" ? "text-white" : "text-navy-900")}>{title}</h2>
      {description && <p className={cn("mt-5 text-lg leading-relaxed", tone === "dark" ? "text-mist-200" : "text-slate-600")}>{description}</p>}
    </Reveal>
  );
}

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("rounded-[var(--radius-card)] border border-mist-200 bg-white p-6 shadow-[var(--shadow-card)]", className)} {...p} />;
export const Badge = ({ className, ...p }: React.HTMLAttributes<HTMLSpanElement>) => <span className={cn("inline-flex items-center rounded-full bg-mist-100 px-2.5 py-1 text-xs font-medium text-navy-700", className)} {...p} />;
