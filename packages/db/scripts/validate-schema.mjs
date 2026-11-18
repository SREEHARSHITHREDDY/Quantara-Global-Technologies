// Offline schema validation + review using Prisma's published schema WASM (no engine download).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.PRISMA_WASM_PANIC_REGISTRY = { set_message(m) { throw new Error(m); } };
const w = require("@prisma/prisma-schema-wasm");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const params = JSON.stringify({ prismaSchema: schema, noColor: true });
try { w.validate(params); console.log("SCHEMA VALID"); } catch (e) { console.log("SCHEMA INVALID:", String(e.message ?? e).slice(0, 3000)); process.exit(1); }
const dmmf = JSON.parse(w.get_dmmf(JSON.stringify({ prismaSchema: schema, noColor: true }))).datamodel;
const models = dmmf.models;
console.log(`models=${models.length} enums=${dmmf.enums.length}`);
const problems = [];
for (const m of models) {
  const idxLead = new Set();
  (m.primaryKey?.fields ?? []).slice(0, 1).forEach((f) => idxLead.add(f));
  m.fields.filter((f) => f.isId || f.isUnique).forEach((f) => idxLead.add(f.name));
  (m.uniqueFields ?? []).forEach((u) => idxLead.add(u[0]));
  (m.uniqueIndexes ?? []).forEach((u) => idxLead.add(u.fields[0]));
  // @@index is not in dmmf; parse from source
  const block = schema.match(new RegExp(`model ${m.name} \\{[\\s\\S]*?\\n\\}`))[0];
  for (const x of block.matchAll(/@@index\(\[([^\]]+)\]/g)) idxLead.add(x[1].split(",")[0].trim());
  for (const f of m.fields) {
    if (f.relationFromFields?.length) {
      const lead = f.relationFromFields[0];
      if (!idxLead.has(lead)) problems.push(`${m.name}.${lead}: FK without leading index`);
      const req = f.isRequired;
      const od = f.relationOnDelete ?? (req ? "Restrict(default)" : "SetNull(default)");
      if (req && od === "SetNull") problems.push(`${m.name}.${f.name}: required relation with SetNull`);
    }
  }
  const names = m.fields.map((f) => f.name);
  if (!names.includes("createdAt") && !["RolePermission","ServiceIndustry","ServiceRelation","InsightTag","MeetingParticipant","ExecutionDocument","RateLimitBucket","RateLimit","Permission","DocumentChunk","ServiceCapability","Tag","Author","InsightCategory","SiteSetting","IntegrationStatus"].includes(m.name)) problems.push(`${m.name}: no createdAt`);
}
console.log(problems.length ? "REVIEW FINDINGS:\n- " + problems.join("\n- ") : "no review findings");
console.log(models.map((m) => m.name).join(", "));
