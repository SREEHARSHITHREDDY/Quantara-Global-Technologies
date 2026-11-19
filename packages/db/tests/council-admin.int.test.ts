import { describe, expect, it } from "vitest";
import { getCouncilWorkspace, getPlatformCouncilUsage, listCouncilAudit, listCouncilWorkspaces, reserveExecution, setCouncilPlan } from "../src";
import { db, makeOrg, makeTenantFixture } from "./helpers";

async function tenant() { return makeTenantFixture(); }

describe("council admin queries", () => {
  it("lists customer workspaces with plan and usage, and finds them by name", async () => {
    const t = await tenant();
    await db.organization.update({ where: { id: t.org.id }, data: { name: "Zed Unique Holdings" } });
    await setCouncilPlan(db, { organizationId: t.org.id, plan: "TRIAL", trialDays: 14 });
    const r = await listCouncilWorkspaces(db, { search: "zed unique" });
    expect(r.total).toBe(1);
    expect(r.items[0]).toMatchObject({ id: t.org.id, plan: "TRIAL", sessions: 1, tokensThisMonth: 0 });
    expect(r.items[0]!.trialEndsAt).toBeInstanceOf(Date);
  });
  it("staff organizations are never listed or opened as workspaces", async () => {
    const staff = await makeOrg("STAFF");
    expect((await listCouncilWorkspaces(db, { search: staff.name })).items.find((x) => x.id === staff.id)).toBeUndefined();
    expect(await getCouncilWorkspace(db, staff.id)).toBeNull();
  });
  it("workspace detail shows operational data only, with no prompt text", async () => {
    const t = await tenant();
    const r = await reserveExecution(db, { organizationId: t.org.id, userId: t.user.id, conversationId: t.conversation.id, mode: "FULL_COUNCIL", prompt: "SECRET STRATEGY TEXT", estimate: { tokens: 1000, costUsd: 0 }, maxConcurrent: 5 });
    expect(r.ok).toBe(true);
    const d = await getCouncilWorkspace(db, t.org.id);
    expect(d!.recent.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(d)).not.toContain("SECRET STRATEGY TEXT");
  });
  it("platform usage and the council audit log reflect plan changes", async () => {
    const t = await tenant();
    await setCouncilPlan(db, { organizationId: t.org.id, plan: "STANDARD", actorId: t.user.id });
    const u = await getPlatformCouncilUsage(db);
    expect(u.workspacesWithAccess).toBeGreaterThanOrEqual(1);
    const log = await listCouncilAudit(db, { organizationId: t.org.id });
    expect(log.items.map((x) => x.action)).toContain("council.plan.set");
    expect(log.items.every((x) => x.action.startsWith("council."))).toBe(true);
  });
});
