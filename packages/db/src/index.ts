// STATUS: unverified. Requires `prisma generate` (needs the Prisma engine download, blocked in the build sandbox).
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

export * from "./generated/client";
export * from "./enquiries";
export * from "./workspace";
export * from "./admin";
export * from "./careers";
export * from "./insights";
export * from "./council";
export { provisionOrganizationRoles, syncPermissions } from "./provision";

export function createPrisma(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const g = globalThis as unknown as { __quantaraPrisma?: PrismaClient };
/** Shared client (reused across Next.js dev reloads). */
export function getPrisma(): PrismaClient {
  return (g.__quantaraPrisma ??= createPrisma());
}
export * from "./council-admin";
