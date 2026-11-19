import { ensureCustomerWorkspace, type PrismaClient } from "@quantara/db";
import { councilDefaultFromEnv } from "./council-default-plan";

/** The one place a customer workspace is created, so every path applies the same Council default. */
export function ensureWorkspace(db: PrismaClient, user: { id: string; name: string }) {
  return ensureCustomerWorkspace(db, user, councilDefaultFromEnv());
}
