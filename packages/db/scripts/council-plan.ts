import "dotenv/config";
import { createPrisma, enableCouncilForDisabledCustomers, findCustomerOrgByEmail, setCouncilPlan } from "../src/index";

// Usage: pnpm --filter @quantara/db council:plan -- you@example.com TRIAL 14
//        pnpm --filter @quantara/db council:plan -- you@example.com STANDARD
//        pnpm --filter @quantara/db council:plan -- you@example.com DISABLED
//        pnpm --filter @quantara/db council:plan -- --all STANDARD    (every customer workspace that is still DISABLED)
const args = process.argv.slice(2).filter((a) => a !== "--");
const all = args[0] === "--all";
const [email, planRaw, days] = all ? [undefined, args[1], args[2]] : args;
const plans = ["DISABLED", "TRIAL", "STANDARD", "ENTERPRISE"] as const;
const plan = plans.find((p) => p === planRaw?.toUpperCase());
if ((!all && !email) || !plan || (all && plan === "DISABLED")) { console.error("Usage: pnpm --filter @quantara/db council:plan -- <email> <DISABLED|TRIAL|STANDARD|ENTERPRISE> [trialDays]"); process.exit(1); }
const db = createPrisma();
(async () => {
  if (all) {
    const n = await enableCouncilForDisabledCustomers(db, { plan: plan as "TRIAL" | "STANDARD" | "ENTERPRISE", trialDays: days ? Number(days) : undefined });
    console.log(`${n} customer workspace(s) set to ${plan}.`);
    return;
  }
  const org = await findCustomerOrgByEmail(db, email!);
  if (!org) throw new Error(`No customer workspace found for ${email}. The person must sign up first.`);
  const r = await setCouncilPlan(db, { organizationId: org.organizationId, plan, trialDays: days ? Number(days) : undefined });
  console.log(`Council for "${org.name}" is now ${plan}${r.trialEndsAt ? ` until ${r.trialEndsAt.toISOString()}` : ""}.`);
})().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => db.$disconnect());
