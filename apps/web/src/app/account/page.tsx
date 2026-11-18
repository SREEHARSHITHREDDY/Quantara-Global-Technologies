import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getMembershipContext } from "@quantara/auth";
import { ensureCustomerWorkspace, getPrisma } from "@quantara/db";
import { can } from "@quantara/rbac";
import { SecurityPanel } from "@/components/auth/security-panel";
import { PageHero } from "@/components/site/page-hero";
import { Container } from "@/components/ui/layout";
import { getAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const db = getPrisma();
  // Normally created at sign-up; this repairs the rare case where that step failed.
  const { organizationId } = await ensureCustomerWorkspace(db, { id: session.user.id, name: session.user.name });
  const [org, ctx] = await Promise.all([db.organization.findUnique({ where: { id: organizationId }, select: { name: true } }), getMembershipContext(db, session.user.id, organizationId)]);
  const twoFactorEnabled = !!(session.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled;
  return (
    <>
      <PageHero eyebrow="Your account" title={session.user.name} description={session.user.email} />
      <section className="bg-mist-50 py-12 sm:py-16">
        <Container className="max-w-3xl space-y-6">
          <div className="rounded-[var(--radius-card)] border border-mist-200 bg-white p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-semibold text-navy-900">Workspace</h2>
            <p className="mt-2 text-sm text-slate-600">{org?.name ?? "Your workspace"}{ctx ? `, role: ${ctx.role}` : ""}</p>
            <p className="mt-1 text-sm text-slate-600">{ctx && can(ctx, "council:use") ? "You have access to the Executive AI Council." : "Executive AI Council access is not enabled for this account."}</p>
          </div>
          <SecurityPanel twoFactorEnabled={twoFactorEnabled} />
        </Container>
      </section>
    </>
  );
}
