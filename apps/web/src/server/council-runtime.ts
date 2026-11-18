import { FREE_RATE, type ProviderId, type Rate } from "@quantara/council";
import { failExecution, getCouncilOrgAccess, getPrisma, hitRateLimit, reserveExecution } from "@quantara/db";
import { createSender, enqueue } from "@quantara/worker";
import type { StartDeps } from "@/server/council-service";

/** Providers that have a working adapter. Real ones are added with their credentials. */
const IMPLEMENTED: ProviderId[] = ["mock"];

const mockAllowed = () => process.env.NODE_ENV !== "production" || process.env.COUNCIL_ENABLE_MOCK === "1";

/** Platform-level provider switch: enabled in the admin settings AND implemented. The Mock provider is on in development and must be switched on explicitly in production. */
async function platformProviders(): Promise<ProviderId[]> {
  const out: ProviderId[] = [];
  const rows: { key: string }[] = await getPrisma().providerConfig.findMany({ where: { isEnabled: true }, select: { key: true } });
  for (const r of rows) if (r.key !== "mock" && (IMPLEMENTED as string[]).includes(r.key)) out.push(r.key as ProviderId);
  if (mockAllowed()) out.push("mock");
  return out;
}
const rateFor = (p: ProviderId): Rate | null => (p === "mock" ? FREE_RATE : null);

type Sender = Awaited<ReturnType<typeof createSender>>;
let sender: Promise<Sender> | null = null;
function getSender(): Promise<Sender> {
  const url = process.env.DATABASE_URL;
  if (!url) return Promise.reject(new Error("DATABASE_URL is required"));
  sender ??= createSender(url).catch((e: unknown) => { sender = null; throw e; });
  return sender;
}

export function councilStartDeps(): StartDeps {
  const db = getPrisma();
  return {
    getAccess: (orgId) => getCouncilOrgAccess(db, orgId),
    platformProviders, rateFor,
    reserve: (input) => reserveExecution(db, input),
    enqueue: async (executionId, organizationId) => { await enqueue(await getSender(), "council.execute", { executionId, organizationId }); },
    fail: async (executionId, organizationId, error) => { await failExecution(db, { executionId, organizationId, error }); },
    hitRateLimit: (k, w, l) => hitRateLimit(db, k, w, l),
    now: () => new Date(),
  };
}
export const siteOrigin = () => process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

/** Provider ids the start form may offer. The service re-validates whatever is submitted. */
export async function councilProviderChoices(): Promise<string[]> { return platformProviders(); }
