import "dotenv/config";
import { createPrisma, grantStaffRole } from "../src/index";

// Usage: pnpm --filter @quantara/db staff:grant -- you@example.com super_admin
const [email, role = "super_admin"] = process.argv.slice(2).filter((a) => a !== "--");
if (!email) { console.error("Usage: pnpm --filter @quantara/db staff:grant -- <email> [role]"); process.exit(1); }
const db = createPrisma();
grantStaffRole(db, email, role)
  .then((r) => console.log(`Granted ${r.role} in the Quantara staff organization to ${email}.`))
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
