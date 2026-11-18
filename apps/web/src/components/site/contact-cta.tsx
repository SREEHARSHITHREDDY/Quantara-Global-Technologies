import { company } from "@quantara/content";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/layout";
import { isLive } from "@/lib/routes";

/** Renders only once /contact exists, so it can never point at a missing page. */
export function ContactCta({ headline = company.ctaHeadline, body = company.ctaBody }: { headline?: string; body?: string }) {
  if (!isLive("/contact")) return null;
  return (
    <Section tone="dark">
      <div className="max-w-3xl">
        <h2 className="text-3xl font-semibold sm:text-4xl">{headline}</h2>
        <p className="mt-5 text-lg leading-relaxed text-mist-200">{body}</p>
        <ButtonLink href="/contact" size="lg" className="mt-8">Talk to our team</ButtonLink>
      </div>
    </Section>
  );
}
