import { randomBytes, randomUUID } from "node:crypto";
import { provisionOrganizationRoles } from "./provision";
import type { PrismaClient } from "./generated/client";

// STATUS: covered by tests/workspace.int.test.ts and tests/auth.int.test.ts (unverified until `pnpm test:db` is run).

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "workspace";

/**
 * Gives a self-registered customer their own CLIENT organization with themselves as its administrator.
 * Idempotent and safe under concurrent calls (per-user advisory lock). Returns the existing workspace if there is one.
 * Platform (CMS/lead/AI) permissions are never granted: `can()` ignores them in CLIENT organizations.
 */
export interface WorkspaceCouncilDefault { councilPlan: "DISABLED" | "TRIAL" | "STANDARD"; councilTrialDays?: number }

export async function ensureCustomerWorkspace(db: PrismaClient, user: { id: string; name: string }, opts: WorkspaceCouncilDefault | undefined = undefined, now = new Date()): Promise<{ organizationId: string; created: boolean }> {
  const result = await db.$transaction(async (tx: Pick<PrismaClient, "member" | "organization" | "auditLog" | "$executeRaw">) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"workspace:" + user.id}))`;
    const existing = await tx.member.findFirst({ where: { userId: user.id, organization: { type: "CLIENT" } }, select: { organizationId: true } });
    if (existing) return { organizationId: existing.organizationId as string, created: false };
    const org = await tx.organization.create({
      data: {
        id: randomUUID(), name: `${user.name.trim() || "My"}'s workspace`, slug: `${slugify(user.name)}-${randomBytes(3).toString("hex")}`, type: "CLIENT", createdAt: now,
        ...(opts && opts.councilPlan !== "DISABLED" ? { councilPlan: opts.councilPlan, councilTrialEndsAt: opts.councilPlan === "TRIAL" ? new Date(now.getTime() + (opts.councilTrialDays ?? 14) * 86_400_000) : null } : {}),
      },
      select: { id: true },
    });
    await tx.member.create({ data: { id: randomUUID(), organizationId: org.id, userId: user.id, role: "admin", createdAt: now } });
    if (opts && opts.councilPlan !== "DISABLED") await tx.auditLog.create({ data: { organizationId: org.id, actorType: "system", action: "council.plan.set", resourceType: "organization", resourceId: org.id, metadata: { plan: opts.councilPlan, source: "workspace_default" } } });
    return { organizationId: org.id as string, created: true };
  });
  // Outside the transaction (it manages its own); idempotent, and repairs a workspace whose roles were never provisioned.
  if (result.created || (await db.role.count({ where: { organizationId: result.organizationId } })) === 0) await provisionOrganizationRoles(db, result.organizationId);
  return result;
}
