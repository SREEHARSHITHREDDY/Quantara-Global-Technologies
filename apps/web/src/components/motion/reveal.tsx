"use client";
import { motion } from "motion/react";

/** Fades and lifts content in as it scrolls into view, once. The layout adds a <noscript> rule so nothing stays hidden without JavaScript. */
export function Reveal({ children, delay = 0, y = 24, className }: { children: React.ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div data-reveal className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }} transition={{ duration: 0.65, delay, ease: [0.25, 1, 0.5, 1] }}>
      {children}
    </motion.div>
  );
}
