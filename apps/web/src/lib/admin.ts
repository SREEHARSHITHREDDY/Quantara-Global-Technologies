import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getMembershipContext } from "@quantara/auth";
import { getPrisma, getStaffMembership } from "@quantara/db";
import { can, type MembershipContext, type Permission } from "@quantara/rbac";
import { getAuth } from "@/lib/auth";

export interface StaffSession { userId: string; name: string; email: string; organizationId: string; ctx: MembershipContext }

/**
 * Server-side gate for every admin page and action. Authorization is resolved from the database:
 *  - no session            -> /staff
 *  - not a staff member    -> 404 (the admin area is not advertised to customers)
 *  - staff without the permission -> 404 as well, so the existence of pages is not leaked
 */
export async function requireStaff(permission?: Permission): Promise<StaffSession> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/staff");
  const db = getPrisma();
  const staff = await getStaffMembership(db, session.user.id);
  if (!staff) notFound();
  const ctx = await getMembershipContext(db, session.user.id, staff.organizationId);
  if (!ctx) notFound();
  if (permission && !can(ctx, permission)) notFound();
  return { userId: session.user.id, name: session.user.name, email: session.user.email, organizationId: staff.organizationId, ctx };
}
