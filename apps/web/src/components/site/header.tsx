import Link from "next/link";
import { company } from "@quantara/content";
import { COUNCIL_HREF, MAIN_NAV, isLive, liveOnly } from "@/lib/routes";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { AuthNav } from "@/components/auth/auth-nav";

export function Header() {
  const items = liveOnly(MAIN_NAV);
  const council = isLive(COUNCIL_HREF);
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-950/90 text-white backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight">{company.name}</Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {items.map((i) => (
            <Link key={i.href} href={i.href} className="rounded-md px-3 py-2 text-sm font-medium text-mist-200 transition-colors hover:bg-white/10 hover:text-white">{i.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <AuthNav className="hidden rounded-md px-3 py-2 text-sm font-medium text-mist-200 transition-colors hover:bg-white/10 hover:text-white sm:inline-block" />
          {council && <ButtonLink href={COUNCIL_HREF} size="sm" className="hidden sm:inline-flex">Executive AI Council</ButtonLink>}
          <details className="relative lg:hidden">
            <summary className="flex h-10 cursor-pointer list-none items-center rounded-md border border-white/20 px-3 text-sm font-medium">Menu</summary>
            <nav aria-label="Mobile" className="absolute right-0 mt-2 w-64 rounded-lg border border-white/10 bg-navy-900 p-2 shadow-xl">
              {items.map((i) => (
                <Link key={i.href} href={i.href} className="block rounded-md px-3 py-2.5 text-sm text-mist-100 hover:bg-white/10">{i.label}</Link>
              ))}
              <AuthNav className="block rounded-md px-3 py-2.5 text-sm text-mist-100 hover:bg-white/10" />
              {council && <Link href={COUNCIL_HREF} className="mt-1 block rounded-md bg-electric-600 px-3 py-2.5 text-sm font-medium">Executive AI Council</Link>}
            </nav>
          </details>
        </div>
      </Container>
    </header>
  );
}
