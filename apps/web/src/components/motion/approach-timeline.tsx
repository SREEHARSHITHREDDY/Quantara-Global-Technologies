"use client";
import { motion } from "motion/react";
import { Reveal } from "./reveal";

/** The five approach steps joined by a line that draws itself as the section scrolls into view. */
export function ApproachTimeline({ steps }: { steps: { step: number; name: string; description: string }[] }) {
  return (
    <ol className="relative mt-14 grid gap-10 md:grid-cols-5 md:gap-6">
      <motion.div aria-hidden data-reveal className="absolute left-[10%] right-[10%] top-5 hidden h-px origin-left bg-gradient-to-r from-electric-500 via-cyan-400 to-electric-500 md:block"
        initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, margin: "0px 0px -20% 0px" }} transition={{ duration: 1.4, ease: [0.25, 1, 0.5, 1] }} />
      {steps.map((a, i) => (
        <li key={a.step} className="relative flex gap-4 md:block md:text-center">
          <Reveal delay={i * 0.12} className="flex gap-4 md:block">
            <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-electric-500/40 bg-white text-sm font-semibold text-electric-600 shadow-[0_0_0_6px_var(--color-mist-50)] md:mx-auto">{a.step}</span>
            <div>
              <h3 className="text-lg font-semibold text-navy-900 md:mt-4">{a.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{a.description}</p>
            </div>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}
