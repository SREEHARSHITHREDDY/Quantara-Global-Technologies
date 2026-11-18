import { PLATFORM_PERMISSIONS, type Permission } from "./permissions";
import { ROLES, isRoleKey } from "./roles";

export type OrgType = "STAFF" | "CLIENT";
export interface MembershipContext {
  /** Role key from the Member row of the ACTIVE organization (resolved server-side, never from the client). */
  role: string | null | undefined;
  orgType: OrgType;
  orgStatus: "ACTIVE" | "SUSPENDED";
  userBanned?: boolean | null;
}

/**
 * Pure decision function. Callers MUST build the context from database state on the server.
 * Default deny: unknown role, suspended org, banned user, or platform permission outside a STAFF org.
 */
export function can(ctx: MembershipContext | null | undefined, permission: Permission): boolean {
  if (!ctx || ctx.userBanned || ctx.orgStatus !== "ACTIVE") return false;
  if (PLATFORM_PERMISSIONS.has(permission) && ctx.orgType !== "STAFF") return false;
  if (!ctx.role || !isRoleKey(ctx.role)) return false;
  // A member may hold several comma-separated roles (Better Auth stores them that way).
  return ctx.role.split(",").map((r) => r.trim()).every(isRoleKey) &&
    ctx.role.split(",").some((r) => ROLES[r.trim() as keyof typeof ROLES].permissions.includes(permission));
}

export function assertCan(ctx: MembershipContext | null | undefined, permission: Permission): void {
  if (!can(ctx, permission)) throw new ForbiddenError(permission);
}
export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(readonly permission: Permission) { super(`Forbidden: ${permission}`); }
}

/** Council data is private to its owner unless the caller holds the org-wide history permission. */
export function canReadCouncilRecord(ctx: MembershipContext, record: { ownerId: string; organizationId: string }, caller: { userId: string; organizationId: string }): boolean {
  if (record.organizationId !== caller.organizationId) return false;
  if (!can(ctx, "council:use") && !can(ctx, "council:history:read:org")) return false;
  return record.ownerId === caller.userId || can(ctx, "council:history:read:org");
}
