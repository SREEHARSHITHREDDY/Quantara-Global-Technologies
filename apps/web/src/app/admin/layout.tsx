import type { Metadata } from "next";
import Link from "next/link";
import { can } from "@quantara/rbac";
import { Container } from "@/components/ui/layout";
import { requireStaff } from "@/lib/admin";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Quantara Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStaff(); // any staff member may enter; each page checks its own permission
  const links = [
    { href: "/admin", label: "Overview", show: true },
    { href: "/admin/enquiries", label: "Enquiries", show: can(s.ctx, "enquiry:read") },
    { href: "/admin/insights", label: "Insights", show: can(s.ctx, "insight:write") },
    { href: "/admin/jobs", label: "Jobs", show: can(s.ctx, "job:write") },
    { href: "/admin/applications", label: "Applications", show: can(s.ctx, "application:read") },
    { href: "/admin/council", label: "Council", show: can(s.ctx, "ai:usage:read") },
    { href: "/admin/settings", label: "Site settings", show: can(s.ctx, "site:settings:read") },
  ].filter((l) => l.show);
  return (
    <div className="min-h-screen bg-mist-50">
      <header className="border-b border-mist-200 bg-white">
        <Container className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-semibold text-navy-900">Quantara Admin</Link>
            <nav aria-label="Admin" className="flex gap-4 text-sm">
              {links.map((l) => <Link key={l.href} href={l.href} className="text-slate-600 hover:text-navy-900">{l.label}</Link>)}
            </nav>
          </div>
          <div className="text-sm text-slate-600">{s.name} · <Link href="/" className="underline">View site</Link></div>
        </Container>
      </header>
      <Container className="py-8">{children}</Container>
    </div>
  );
}
