import type { PrismaClient } from "./generated/client";

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const PAGE = 25;
const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

export interface WorkspaceRow {
  id: string; name: string; plan: string; trialEndsAt: Date | null; maxConcurrent: number | null;
  members: number; sessions: number; tokensThisMonth: number; costThisMonth: number;
}

/** Customer workspaces with their council plan and this month's usage. Staff organizations are not listed. Never returns prompt or report content. */
export async function listCouncilWorkspaces(db: PrismaClient, a: { search?: string; page?: number; now?: Date }): Promise<{ items: WorkspaceRow[]; total: number; page: number; pages: number }> {
  const page = Math.max(a.page ?? 1, 1);
  const where = { type: "CLIENT" as const, ...(a.search?.trim() ? { name: { contains: a.search.trim(), mode: "insensitive" as const } } : {}) };
  const [total, orgs] = await Promise.all([
    db.organization.count({ where }),
    db.organization.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, select: { id: true, name: true, councilPlan: true, councilTrialEndsAt: true, councilMaxConcurrent: true, _count: { select: { members: true } } } }),
  ]);
  const ids = (orgs as { id: string }[]).map((o) => o.id);
  const since = monthStart(a.now ?? new Date());
  const [counts, usage] = ids.length
    ? await Promise.all([
        db.execution.groupBy({ by: ["organizationId"], where: { organizationId: { in: ids } }, _count: { _all: true } }),
        db.execution.groupBy({ by: ["organizationId"], where: { organizationId: { in: ids }, createdAt: { gte: since } }, _sum: { tokensUsed: true, costUsd: true } }),
      ])
    : [[], []];
  const countBy = new Map((counts as { organizationId: string; _count: { _all: number } }[]).map((c) => [c.organizationId, c._count._all]));
  const usageBy = new Map((usage as { organizationId: string; _sum: { tokensUsed: number | null; costUsd: unknown } }[]).map((u) => [u.organizationId, u._sum]));
  const items = (orgs as { id: string; name: string; councilPlan: string; councilTrialEndsAt: Date | null; councilMaxConcurrent: number | null; _count: { members: number } }[]).map((o) => ({
    id: o.id, name: o.name, plan: o.councilPlan, trialEndsAt: o.councilTrialEndsAt, maxConcurrent: o.councilMaxConcurrent,
    members: o._count.members, sessions: countBy.get(o.id) ?? 0, tokensThisMonth: usageBy.get(o.id)?.tokensUsed ?? 0, costThisMonth: num(usageBy.get(o.id)?.costUsd),
  }));
  return { items, total, page, pages: Math.max(Math.ceil(total / PAGE), 1) };
}

export interface PlatformUsage { periodStart: Date; sessions: number; tokens: number; costUsd: number; byStatus: Record<string, number>; workspacesWithAccess: number }

export async function getPlatformCouncilUsage(db: PrismaClient, now: Date = new Date()): Promise<PlatformUsage> {
  const periodStart = monthStart(now);
  const clientOrgs = { organization: { type: "CLIENT" as const } };
  const [agg, byStatus, workspacesWithAccess] = await Promise.all([
    db.execution.aggregate({ where: { createdAt: { gte: periodStart }, ...clientOrgs }, _sum: { tokensUsed: true, costUsd: true }, _count: { _all: true } }),
    db.execution.groupBy({ by: ["status"], where: { createdAt: { gte: periodStart }, ...clientOrgs }, _count: { _all: true } }),
    db.organization.count({ where: { type: "CLIENT", councilPlan: { not: "DISABLED" } } }),
  ]);
  return {
    periodStart, sessions: agg._count._all, tokens: agg._sum.tokensUsed ?? 0, costUsd: num(agg._sum.costUsd),
    byStatus: Object.fromEntries((byStatus as { status: string; _count: { _all: number } }[]).map((r) => [r.status, r._count._all])), workspacesWithAccess,
  };
}

export interface AuditRow { id: string; at: Date; action: string; actorId: string | null; actorType: string; organizationId: string | null; resourceType: string | null; resourceId: string | null; metadata: unknown }

/** Council-related audit entries (action prefix `council.`), newest first. */
export async function listCouncilAudit(db: PrismaClient, a: { action?: string; organizationId?: string; page?: number }): Promise<{ items: AuditRow[]; total: number; page: number; pages: number }> {
  const page = Math.max(a.page ?? 1, 1);
  const where = { action: a.action ? { equals: a.action } : { startsWith: "council." }, ...(a.organizationId ? { organizationId: a.organizationId } : {}) };
  const [total, rows] = await Promise.all([db.auditLog.count({ where }), db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 })]);
  const items = (rows as { id: string; createdAt: Date; action: string; actorId: string | null; actorType: string; organizationId: string | null; resourceType: string | null; resourceId: string | null; metadata: unknown }[]).map((r) => ({ id: r.id, at: r.createdAt, action: r.action, actorId: r.actorId, actorType: r.actorType, organizationId: r.organizationId, resourceType: r.resourceType, resourceId: r.resourceId, metadata: r.metadata }));
  return { items, total, page, pages: Math.max(Math.ceil(total / 50), 1) };
}

export interface WorkspaceDetail { id: string; name: string; plan: string; trialEndsAt: Date | null; maxConcurrent: number | null; members: number; recent: { id: string; status: string; mode: string; tokensUsed: number; costUsd: number; createdAt: Date }[] }

/** Operational view of one customer workspace. Deliberately omits prompts, results and member identities. */
export async function getCouncilWorkspace(db: PrismaClient, organizationId: string): Promise<WorkspaceDetail | null> {
  const o = await db.organization.findFirst({ where: { id: organizationId, type: "CLIENT" }, select: { id: true, name: true, councilPlan: true, councilTrialEndsAt: true, councilMaxConcurrent: true, _count: { select: { members: true } } } });
  if (!o) return null;
  const recent = await db.execution.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, status: true, mode: true, tokensUsed: true, costUsd: true, createdAt: true } });
  return { id: o.id, name: o.name, plan: o.councilPlan, trialEndsAt: o.councilTrialEndsAt, maxConcurrent: o.councilMaxConcurrent, members: o._count.members, recent: (recent as { id: string; status: string; mode: string; tokensUsed: number; costUsd: unknown; createdAt: Date }[]).map((r) => ({ ...r, costUsd: num(r.costUsd) })) };
}
