import { company } from "@quantara/content";
import { Container } from "@/components/ui/layout";

// PHASE 1 SCAFFOLD ONLY. The real homepage (16 sections) is built in Phase 2.
// It deliberately contains no buttons: none of the destination routes exist yet.
export default function ScaffoldHome() {
  return (
    <div className="bg-hero min-h-screen text-white">
      <Container className="flex min-h-screen flex-col justify-center py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">{company.name}</p>
        <h1 className="animate-rise mt-6 max-w-4xl text-4xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl">{company.tagline}</h1>
        <p className="mt-6 max-w-2xl text-lg text-mist-200">{company.supportingTagline}</p>
        <p className="mt-16 text-sm text-mist-300">Platform scaffold. The public website is built in Phase 2.</p>
      </Container>
    </div>
  );
}
