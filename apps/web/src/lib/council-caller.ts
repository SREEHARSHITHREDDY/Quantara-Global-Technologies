import { headers } from "next/headers";
import { getMembershipContext } from "@quantara/auth";
import { getPrisma } from "@quantara/db";
import { ensureWorkspace } from "@/lib/workspace";
import { getAuth } from "@/lib/auth";
import type { Caller } from "@/server/council-service";

/** The signed-in user, their customer workspace and role, all resolved from the database. Null when signed out. */
export async function getCouncilCaller(): Promise<Caller | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const db = getPrisma();
  const { organizationId } = await ensureWorkspace(db, { id: session.user.id, name: session.user.name });
  const ctx = await getMembershipContext(db, session.user.id, organizationId);
  return ctx ? { userId: session.user.id, organizationId, ctx } : null;
}
