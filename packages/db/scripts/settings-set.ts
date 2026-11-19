import "dotenv/config";
import { EDITABLE_SETTINGS, createPrisma, getStaffMembership, saveSettings, validateSettings } from "../src/index";

// Usage: pnpm --filter @quantara/db settings:set -- you@example.com contact.email=cto@example.com contact.careersEmail=hr@example.com
//        (first argument is the email of a staff member; it is recorded as the person who made the change)
// An empty value removes a setting, e.g. contact.phone=
const [actorEmail, ...pairs] = process.argv.slice(2).filter((a) => a !== "--");
const keys = EDITABLE_SETTINGS.map((s) => s.key as string);
if (!actorEmail || pairs.length === 0) {
  console.error(`Usage: pnpm --filter @quantara/db settings:set -- <staff-email> key=value [key=value ...]\nKeys: ${keys.join(", ")}`);
  process.exit(1);
}
const input: Record<string, string> = {};
for (const p of pairs) {
  const i = p.indexOf("=");
  const k = i < 0 ? p : p.slice(0, i);
  if (!keys.includes(k)) { console.error(`Unknown setting "${k}". Keys: ${keys.join(", ")}`); process.exit(1); }
  input[k] = i < 0 ? "" : p.slice(i + 1);
}
const db = createPrisma();
(async () => {
  const user = await db.user.findFirst({ where: { email: actorEmail.trim().toLowerCase() }, select: { id: true } });
  if (!user) throw new Error(`No user with email ${actorEmail}.`);
  const staff = await getStaffMembership(db, user.id);
  if (!staff) throw new Error(`${actorEmail} is not staff. Run staff:grant for that email first.`);
  const { values, errors } = validateSettings(input as never);
  if (Object.keys(errors).length) throw new Error(Object.entries(errors).map(([k, m]) => `${k}: ${m}`).join("; "));
  const changed = await saveSettings(db, values, user.id, staff.organizationId);
  console.log(changed.length ? `Saved: ${changed.join(", ")}` : "Nothing changed.");
})().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => db.$disconnect());
