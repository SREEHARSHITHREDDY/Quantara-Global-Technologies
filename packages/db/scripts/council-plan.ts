import "dotenv/config";
import { createPrisma, findCustomerOrgByEmail, setCouncilPlan } from "../src/index";

// Usage: pnpm --filter @quantara/db council:plan -- you@example.com TRIAL 14
//        pnpm --filter @quantara/db council:plan -- you@example.com STANDARD
//        pnpm --filter @quantara/db council:plan -- you@example.com DISABLED
const [email, planRaw, days] = process.argv.slice(2).filter((a) => a !== "--");
const plans = ["DISABLED", "TRIAL", "STANDARD", "ENTERPRISE"] as const;
const plan = plans.find((p) => p === planRaw?.toUpperCase());
if (!email || !plan) { console.error("Usage: pnpm --filter @quantara/db council:plan -- <email> <DISABLED|TRIAL|STANDARD|ENTERPRISE> [trialDays]"); process.exit(1); }
const db = createPrisma();
(async () => {
  const org = await findCustomerOrgByEmail(db, email);
  if (!org) throw new Error(`No customer workspace found for ${email}. The person must sign up first.`);
  const r = await setCouncilPlan(db, { organizationId: org.organizationId, plan, trialDays: days ? Number(days) : undefined });
  console.log(`Council for "${org.name}" is now ${plan}${r.trialEndsAt ? ` until ${r.trialEndsAt.toISOString()}` : ""}.`);
})().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => db.$disconnect());
