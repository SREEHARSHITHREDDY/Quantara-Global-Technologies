import Link from "next/link";
import { company } from "@quantara/content";
import { COUNCIL_HREF, MAIN_NAV, isLive, liveOnly } from "@/lib/routes";
import { getSiteContact } from "@/lib/site-settings";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { AuthNav } from "@/components/auth/auth-nav";
import { ScrollProgress } from "@/components/motion/scroll-progress";
import { SiteMenu } from "./site-menu";

export async function Header() {
  const items = liveOnly(MAIN_NAV);
  const council = isLive(COUNCIL_HREF);
  const contact = await getSiteContact();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-950/85 text-white backdrop-blur-md">
      <Container className="flex h-16 items-center gap-3">
        <SiteMenu brand={company.name} items={items} councilHref={council ? COUNCIL_HREF : undefined} contactEmail={contact.email} />
        <Link href="/" className="shrink-0 whitespace-nowrap font-display text-lg font-semibold tracking-tight">{company.name}</Link>
        <div className="ml-auto flex items-center gap-3">
          <AuthNav className="hidden whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium text-mist-200 transition-colors hover:bg-white/10 hover:text-white sm:inline-block" />
          {council && <ButtonLink href={COUNCIL_HREF} size="sm" className="hidden whitespace-nowrap sm:inline-flex">Executive AI Council</ButtonLink>}
        </div>
      </Container>
      <ScrollProgress />
    </header>
  );
}
