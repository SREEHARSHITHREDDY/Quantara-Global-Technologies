import { ALL_PERMISSIONS, PERMISSIONS, ROLES } from "@quantara/rbac";
import type { PrismaClient } from "./generated/client";

type Db = Pick<PrismaClient, "permission" | "role" | "rolePermission" | "$transaction">;

/** Upsert the permission registry from code. Idempotent. */
export async function syncPermissions(db: Db): Promise<void> {
  for (const key of ALL_PERMISSIONS) {
    await db.permission.upsert({ where: { key }, update: { description: PERMISSIONS[key] }, create: { key, description: PERMISSIONS[key] } });
  }
}

/**
 * Give an organization its own copy of the system roles and make role→permission rows match the
 * code-defined matrix exactly. Idempotent. Call on organization creation and on every deploy (seed).
 */
export async function provisionOrganizationRoles(db: Db, organizationId: string): Promise<void> {
  await syncPermissions(db);
  const perms = await db.permission.findMany({ select: { id: true, key: true } });
  const permId = new Map(perms.map((p) => [p.key as string, p.id]));
  for (const def of Object.values(ROLES)) {
    const role = await db.role.upsert({
      where: { organizationId_key: { organizationId, key: def.key } },
      update: { name: def.name, description: def.description, system: true },
      create: { organizationId, key: def.key, name: def.name, description: def.description, system: true },
    });
    const wanted = new Set(def.permissions.map((k) => permId.get(k)!));
    await db.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: { notIn: [...wanted] } } });
    await db.rolePermission.createMany({ data: [...wanted].map((permissionId) => ({ roleId: role.id, permissionId })), skipDuplicates: true });
  }
}
