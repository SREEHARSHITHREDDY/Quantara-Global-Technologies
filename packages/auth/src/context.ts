import type { MembershipContext } from "@quantara/rbac";

/** Minimal DB surface needed to resolve authorization. Satisfied by the Prisma client (and by fakes in tests). */
/* eslint-disable @typescript-eslint/no-explicit-any -- `select` is typed loosely so Prisma's generated generic signatures remain assignable */
export interface AuthDb {
  member: { findUnique(args: { where: { organizationId_userId: { organizationId: string; userId: string } }; select?: any }): Promise<{ role: string } | null> };
  organization: { findUnique(args: { where: { id: string }; select?: any }): Promise<{ type: "STAFF" | "CLIENT"; status: "ACTIVE" | "SUSPENDED" } | null> };
  user: { findUnique(args: { where: { id: string }; select?: any }): Promise<{ banned: boolean | null; banExpires: Date | null } | null> };
}

/**
 * Resolve the caller's authorization context from DATABASE state. Never trusts roles from the
 * client, cookies or JWT claims. Returns null (= deny) if the user is not a member of the organization.
 */
export async function getMembershipContext(db: AuthDb, userId: string, organizationId: string, now = new Date()): Promise<MembershipContext | null> {
  const [member, org, user] = await Promise.all([
    db.member.findUnique({ where: { organizationId_userId: { organizationId, userId } }, select: { role: true } }),
    db.organization.findUnique({ where: { id: organizationId }, select: { type: true, status: true } }),
    db.user.findUnique({ where: { id: userId }, select: { banned: true, banExpires: true } }),
  ]);
  if (!member || !org || !user) return null;
  const bannedNow = !!user.banned && (!user.banExpires || user.banExpires > now);
  return { role: member.role, orgType: org.type, orgStatus: org.status, userBanned: bannedNow };
}
