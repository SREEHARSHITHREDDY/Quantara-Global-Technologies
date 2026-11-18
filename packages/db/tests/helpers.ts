import { randomUUID } from "node:crypto";
import { createPrisma } from "../src/index";
import { provisionOrganizationRoles } from "../src/provision";

export const db = createPrisma(process.env.TEST_DATABASE_URL);
export const id = (p: string) => `${p}_${randomUUID().slice(0, 8)}`;

export async function makeUser(email = `${id("u")}@example.test`) {
  return db.user.create({ data: { id: id("user"), name: "Test", email: email.toLowerCase(), emailVerified: true } });
}
export async function makeOrg(type: "STAFF" | "CLIENT" = "CLIENT") {
  const slug = id("org").replace(/_/g, "-");
  const org = await db.organization.create({ data: { id: id("orgid"), name: slug, slug, type, createdAt: new Date() } });
  await provisionOrganizationRoles(db, org.id);
  return org;
}
export async function makeMember(organizationId: string, userId: string, role = "council_user") {
  return db.member.create({ data: { id: id("mem"), organizationId, userId, role, createdAt: new Date() } });
}
export async function makeAgent(key = id("A").toUpperCase()) {
  return db.agent.create({ data: { key, name: key, designation: key, department: "Test", description: "t", responsibilities: [], capabilities: [] } });
}
/** Org + member user + conversation + execution, all consistent. */
export async function makeTenantFixture() {
  const org = await makeOrg(); const user = await makeUser(); await makeMember(org.id, user.id);
  const conversation = await db.conversation.create({ data: { organizationId: org.id, userId: user.id, title: "t", mode: "FULL_COUNCIL" } });
  const execution = await db.execution.create({ data: { organizationId: org.id, userId: user.id, conversationId: conversation.id, mode: "FULL_COUNCIL", prompt: "p", tokenBudget: 1000, costBudgetUsd: "1.0" } });
  return { org, user, conversation, execution };
}
export async function rejects(p: Promise<unknown>, pattern?: RegExp) {
  try { await p; } catch (e) { const msg = String((e as Error).message); if (pattern && !pattern.test(msg)) throw new Error(`rejected with unexpected message: ${msg}`); return true; }
  throw new Error("expected the database to reject this operation, but it succeeded");
}
