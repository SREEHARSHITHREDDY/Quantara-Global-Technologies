import { Container, Eyebrow } from "@/components/ui/layout";

export function PageHero({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="bg-hero text-white">
      <Container className="py-20 sm:py-28">
        {eyebrow && <Eyebrow className="text-cyan-400">{eyebrow}</Eyebrow>}
        <h1 className="animate-rise mt-4 max-w-4xl text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-6xl">{title}</h1>
        {description && <p className="mt-6 max-w-2xl text-lg leading-relaxed text-mist-200">{description}</p>}
        {children && <div className="mt-8">{children}</div>}
      </Container>
    </div>
  );
}
