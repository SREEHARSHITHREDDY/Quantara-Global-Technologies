"use client";
import { motion, useScroll, useSpring } from "motion/react";

/** A thin line under the header that fills as the page is read. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.2 });
  return <motion.div aria-hidden style={{ scaleX }} className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-gradient-to-r from-electric-500 via-cyan-400 to-electric-400" />;
}
