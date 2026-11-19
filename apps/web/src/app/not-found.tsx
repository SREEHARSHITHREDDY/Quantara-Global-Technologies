import { Container } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="bg-white py-28"><Container className="max-w-xl text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-electric-600">404</p>
      <h1 className="mt-3 text-4xl font-semibold text-navy-900">Page not found</h1>
      <p className="mt-4 text-slate-600">The page you are looking for does not exist or may have moved.</p>
      <ButtonLink href="/" className="mt-8">Back to home</ButtonLink>
    </Container></section>
  );
}
