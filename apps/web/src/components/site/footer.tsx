import Link from "next/link";
import { company, industries, services } from "@quantara/content";
import { LEGAL_NAV, MAIN_NAV, liveOnly } from "@/lib/routes";
import { Container } from "@/components/ui/layout";

// Contact details, legal entity name and social links are deliberately NOT here. They are CMS-managed
// SiteSetting values and are wired into the footer in the CMS stage; nothing is hardcoded.
export function Footer() {
  const company_ = liveOnly(MAIN_NAV);
  const legal = liveOnly(LEGAL_NAV);
  const col = "text-sm text-mist-300 transition-colors hover:text-white";
  return (
    <footer className="bg-navy-950 text-white">
      <Container className="grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-lg font-semibold">{company.name}</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-mist-300">{company.closingTagline}</p>
        </div>
        <nav aria-label="Services"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">What we do</p>
          <ul className="mt-4 space-y-2">{services.map((s) => <li key={s.slug}><Link className={col} href={`/services/${s.slug}`}>{s.title}</Link></li>)}</ul></nav>
        <nav aria-label="Industries"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">Industries</p>
          <ul className="mt-4 space-y-2">{industries.map((i) => <li key={i.slug}><Link className={col} href={`/industries/${i.slug}`}>{i.title}</Link></li>)}</ul></nav>
        <nav aria-label="Company"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">Company</p>
          <ul className="mt-4 space-y-2">{company_.map((i) => <li key={i.href}><Link className={col} href={i.href}>{i.label}</Link></li>)}</ul></nav>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-3 py-6 text-xs text-mist-300 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {company.name}. All rights reserved.</p>
          {legal.length > 0 && <ul className="flex gap-5">{legal.map((i) => <li key={i.href}><Link className="hover:text-white" href={i.href}>{i.label}</Link></li>)}</ul>}
        </Container>
      </div>
    </footer>
  );
}
