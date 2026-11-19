"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { AuthNav } from "@/components/auth/auth-nav";
import { cn } from "@/lib/cn";

interface Props { brand: string; items: { label: string; href: string }[]; councilHref?: string | undefined; contactEmail?: string | undefined }

/** Left-hand hamburger that opens a slide-out menu. Closes on Escape, on outside click and on navigation; keeps keyboard focus inside while open. */
export function SiteMenu({ brand, items, councilHref, contactEmail }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const trigger = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const f = Array.from(panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
      const first = f[0], last = f[f.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const t = trigger.current;
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); t?.focus(); };
  }, [open]);

  const link = "block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-mist-200 transition-colors hover:bg-white/10 hover:text-white";
  return (
    <>
      <button ref={trigger} type="button" aria-label="Open menu" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen(true)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 text-white transition-colors hover:bg-white/10">
        <Menu aria-hidden className="h-5 w-5" />
      </button>
      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <div className="fixed inset-0 z-[60]">
              <motion.div aria-hidden className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={() => setOpen(false)} />
              <motion.div ref={panel} id="site-menu" role="dialog" aria-modal="true" aria-label="Site menu"
                className="bg-hero absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col border-r border-white/10 text-white shadow-2xl"
                initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 320, damping: 36 }}>
                <div className="flex h-16 shrink-0 items-center justify-between px-5">
                  <span className="font-display text-lg font-semibold tracking-tight">{brand}</span>
                  <button ref={closeBtn} type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 hover:bg-white/10"><X aria-hidden className="h-5 w-5" /></button>
                </div>
                <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
                  <ul>
                    {items.map((i, n) => {
                      const active = i.href === "/" ? pathname === "/" : pathname.startsWith(i.href);
                      return (
                        <motion.li key={i.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + n * 0.04, duration: 0.35, ease: [0.25, 1, 0.5, 1] }}>
                          <Link href={i.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                            className={cn("group flex items-center gap-3 rounded-lg px-3 py-3 font-display text-xl font-semibold tracking-tight transition-colors hover:bg-white/10", active ? "text-white" : "text-mist-200 hover:text-white")}>
                            <span aria-hidden className={cn("h-1.5 rounded-full bg-cyan-400 transition-all", active ? "w-6" : "w-1.5 opacity-40 group-hover:w-4 group-hover:opacity-100")} />
                            {i.label}
                          </Link>
                        </motion.li>
                      );
                    })}
                  </ul>
                </nav>
                <div className="shrink-0 space-y-1 border-t border-white/10 p-4">
                  <AuthNav className={link} />
                  {councilHref && <Link href={councilHref} onClick={() => setOpen(false)} className="mt-2 flex h-11 items-center justify-center rounded-lg bg-electric-600 text-sm font-medium text-white hover:bg-electric-500">Executive AI Council</Link>}
                  {contactEmail && <a href={`mailto:${contactEmail}`} className="block px-3 pt-3 text-xs text-mist-300 hover:text-white">{contactEmail}</a>}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
