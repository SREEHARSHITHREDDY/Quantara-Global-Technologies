// STATUS: unverified — written but never executed.
import { describe, it, expect } from "vitest";
import { db, id, makeAgent, makeMember, makeOrg, makeTenantFixture, makeUser, rejects } from "./helpers";

const enquiry = (o: object = {}) => ({ referenceId: id("QNT-ENQ"), fullName: "A", businessEmail: "a@b.test", organization: "O", jobDesignation: "D", country: "IN", projectRequirements: "x", privacyConsent: true, consentAt: new Date(), consentTextVersion: "v1", ...o });

describe("data-integrity constraints", () => {
  it("rejects enquiries without affirmative privacy consent", async () => {
    await rejects(db.contactEnquiry.create({ data: enquiry({ privacyConsent: false }) }));
    await db.contactEnquiry.create({ data: enquiry() });
  });
  it("de-duplicates by idempotency key", async () => {
    const k = id("idem"); await db.contactEnquiry.create({ data: enquiry({ idempotencyKey: k }) });
    await rejects(db.contactEnquiry.create({ data: enquiry({ idempotencyKey: k }) }));
  });
  it("rejects malformed slugs and upper-case emails", async () => {
    await rejects(db.service.create({ data: { slug: "Bad Slug", title: "t", summary: "s", introduction: "i", overview: "o" } }));
    await rejects(db.newsletterSubscriber.create({ data: { email: "Mixed@Example.test", consentAt: new Date() } }));
  });
  it("won't publish an insight without a publication date", async () => {
    await rejects(db.insight.create({ data: { slug: id("ins").replace("_", "-"), title: "t", excerpt: "e", body: "b", status: "PUBLISHED" } }));
  });
  it("rejects a second application by the same email for the same job", async () => {
    const job = await db.job.create({ data: { slug: id("job").replace("_", "-"), title: "t", department: "d", employmentType: "FULL_TIME", location: "l", description: "d" } });
    const app = { jobId: job.id, applicantName: "n", applicantEmail: "c@d.test", resumeStorageKey: id("k"), resumeFilename: "cv.pdf", resumeMimeType: "application/pdf", resumeSizeBytes: 1000, resumeSha256: "0".repeat(64), privacyConsent: true, consentAt: new Date() };
    await db.jobApplication.create({ data: { ...app, referenceId: id("APP") } });
    await rejects(db.jobApplication.create({ data: { ...app, referenceId: id("APP"), resumeStorageKey: id("k") } }));
    await rejects(db.jobApplication.create({ data: { ...app, applicantEmail: "e@f.test", referenceId: id("APP"), resumeSizeBytes: 50_000_000, resumeStorageKey: id("k") } }));
  });
});

describe("market statistic publication gate", () => {
  const stat = (o: object) => ({ key: id("stat"), statement: "s", theme: "gcc", ...o });
  it("rejects publishing without a source", async () => { await rejects(db.marketStatistic.create({ data: stat({ isPublished: true, verifiedAt: new Date() }) })); });
  it("rejects publishing a sourced but unverified statistic", async () => {
    const src = await db.source.create({ data: { title: "t", publisher: "p", url: `https://x.test/${id("s")}`, publishedAt: new Date("2026-01-01"), accessedAt: new Date() } });
    await rejects(db.marketStatistic.create({ data: stat({ isPublished: true, sourceId: src.id }) }));
    await db.marketStatistic.create({ data: stat({ isPublished: true, sourceId: src.id, verifiedAt: new Date(), verifiedBy: "test" }) });
  });
  it("a source must carry a publication date", async () => {
    await rejects(db.$executeRawUnsafe(`INSERT INTO "Source"("id","title","publisher","url","accessedAt") VALUES ('x','t','p','https://y.test/z', now())`));
  });
});

describe("tenant isolation enforced by the database", () => {
  it("rejects an execution whose conversation belongs to another organization", async () => {
    const a = await makeTenantFixture(); const b = await makeTenantFixture();
    await rejects(db.execution.create({ data: { organizationId: b.org.id, userId: b.user.id, conversationId: a.conversation.id, mode: "INDIVIDUAL", prompt: "x", tokenBudget: 10, costBudgetUsd: "0.1" } }));
  });
  it("rejects an execution run by someone other than the conversation owner", async () => {
    const a = await makeTenantFixture(); const other = await makeUser(); await makeMember(a.org.id, other.id);
    await rejects(db.execution.create({ data: { organizationId: a.org.id, userId: other.id, conversationId: a.conversation.id, mode: "INDIVIDUAL", prompt: "x", tokenBudget: 10, costBudgetUsd: "0.1" } }));
  });
  it("rejects conversations created by non-members", async () => {
    const org = await makeOrg(); const outsider = await makeUser();
    await rejects(db.conversation.create({ data: { organizationId: org.id, userId: outsider.id, title: "t", mode: "INDIVIDUAL" } }));
  });
  it("rejects a report whose owner differs from the execution's", async () => {
    const a = await makeTenantFixture(); const other = await makeUser(); await makeMember(a.org.id, other.id);
    await rejects(db.report.create({ data: { organizationId: a.org.id, userId: other.id, executionId: a.execution.id, title: "t" } }));
    await db.report.create({ data: { organizationId: a.org.id, userId: a.user.id, executionId: a.execution.id, title: "t" } });
  });
  it("rejects approvals and usage that reference another organization's execution", async () => {
    const a = await makeTenantFixture(); const b = await makeTenantFixture();
    await rejects(db.approvalRequest.create({ data: { organizationId: b.org.id, executionId: a.execution.id, category: "PAYMENT", title: "t", description: "d" } }));
    await rejects(db.usageRecord.create({ data: { organizationId: b.org.id, executionId: a.execution.id, provider: "p", model: "m", tokensIn: 1, tokensOut: 1, costUsd: "0.01" } }));
  });
  it("blocks attaching another org's or another user's private document", async () => {
    const a = await makeTenantFixture(); const b = await makeTenantFixture();
    const doc = (t: typeof a, o: object = {}) => db.document.create({ data: { organizationId: t.org.id, ownerId: t.user.id, filename: "f.pdf", mimeType: "application/pdf", sizeBytes: 10, sha256: "0".repeat(64), storageKey: id("sk"), ...o } });
    const foreign = await doc(b);
    await rejects(db.executionDocument.create({ data: { executionId: a.execution.id, documentId: foreign.id } }));
    const peer = await makeUser(); await makeMember(a.org.id, peer.id);
    const peerPrivate = await db.document.create({ data: { organizationId: a.org.id, ownerId: peer.id, filename: "p.pdf", mimeType: "application/pdf", sizeBytes: 10, sha256: "0".repeat(64), storageKey: id("sk") } });
    await rejects(db.executionDocument.create({ data: { executionId: a.execution.id, documentId: peerPrivate.id } }));
    const shared = await db.document.update({ where: { id: peerPrivate.id }, data: { visibility: "ORGANIZATION" } });
    await db.executionDocument.create({ data: { executionId: a.execution.id, documentId: shared.id } });
  });
  it("chunks must match their document's organization and owner", async () => {
    const a = await makeTenantFixture(); const b = await makeTenantFixture();
    const d = await db.document.create({ data: { organizationId: a.org.id, ownerId: a.user.id, filename: "f", mimeType: "text/plain", sizeBytes: 5, sha256: "0".repeat(64), storageKey: id("sk") } });
    await rejects(db.documentChunk.create({ data: { documentId: d.id, organizationId: b.org.id, ownerId: a.user.id, chunkIndex: 0, text: "x" } }));
  });
  it("populates the full-text vector for chunks", async () => {
    const a = await makeTenantFixture();
    const d = await db.document.create({ data: { organizationId: a.org.id, ownerId: a.user.id, filename: "f", mimeType: "text/plain", sizeBytes: 5, sha256: "0".repeat(64), storageKey: id("sk") } });
    await db.documentChunk.create({ data: { documentId: d.id, organizationId: a.org.id, ownerId: a.user.id, chunkIndex: 0, text: "quantum readiness assessment" } });
    const rows = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) n FROM "DocumentChunk" WHERE "documentId" = ${d.id} AND search @@ plainto_tsquery('english','quantum')`;
    expect(Number(rows[0]!.n)).toBe(1);
  });
});

describe("council rules", () => {
  it("allows only one active configuration per agent", async () => {
    const agent = await makeAgent();
    const cfg = (version: number, isActive: boolean) => ({ agentId: agent.id, version, isActive, systemPrompt: "p", allowedTools: [], outputSchemaKey: "k" });
    await db.agentConfig.create({ data: cfg(1, true) });
    await rejects(db.agentConfig.create({ data: cfg(2, true) }));
    await db.agentConfig.create({ data: cfg(2, false) });
  });
  it("enforces execution iteration/budget bounds", async () => {
    const a = await makeTenantFixture();
    await rejects(db.execution.update({ where: { id: a.execution.id }, data: { iteration: 99 } }));
    await rejects(db.execution.update({ where: { id: a.execution.id }, data: { tokensUsed: -1 } }));
  });
  it("agent messages need an agent id; agents cannot message themselves", async () => {
    const a = await makeTenantFixture(); const ag = await makeAgent();
    await rejects(db.message.create({ data: { conversationId: a.conversation.id, role: "AGENT", content: "x" } }));
    await rejects(db.agentMessage.create({ data: { executionId: a.execution.id, fromAgentId: ag.id, toAgentId: ag.id, type: "CHALLENGE", round: 1, payload: {} } }));
  });
  it("approval decisions must be consistent", async () => {
    const a = await makeTenantFixture();
    await rejects(db.approvalRequest.create({ data: { organizationId: a.org.id, category: "PAYMENT", title: "t", description: "d", status: "APPROVED" } }));
    await db.approvalRequest.create({ data: { organizationId: a.org.id, category: "PAYMENT", title: "t", description: "d" } });
  });
  it("AgentEvent sequence numbers are unique per execution", async () => {
    const a = await makeTenantFixture();
    await db.agentEvent.create({ data: { executionId: a.execution.id, seq: 1, type: "execution.started" } });
    await rejects(db.agentEvent.create({ data: { executionId: a.execution.id, seq: 1, type: "dup" } }));
  });
});

describe("audit log immutability and cascades", () => {
  it("cannot be edited or deleted", async () => {
    const log = await db.auditLog.create({ data: { action: "test.action" } });
    await rejects(db.auditLog.update({ where: { id: log.id }, data: { action: "tampered" } }));
    await rejects(db.auditLog.delete({ where: { id: log.id } }));
  });
  it("survives organization deletion with the org reference nulled", async () => {
    const org = await makeOrg(); const log = await db.auditLog.create({ data: { action: "org.test", organizationId: org.id } });
    await db.organization.delete({ where: { id: org.id } });
    const after = await db.auditLog.findUnique({ where: { id: log.id } });
    expect(after).not.toBeNull(); expect(after!.organizationId).toBeNull();
  });
  it("deleting an organization removes its council data", async () => {
    const a = await makeTenantFixture();
    await db.organization.delete({ where: { id: a.org.id } });
    expect(await db.execution.count({ where: { id: a.execution.id } })).toBe(0);
    expect(await db.conversation.count({ where: { id: a.conversation.id } })).toBe(0);
  });
  it("unique (organization, role key) holds; roles are per-organization", async () => {
    const org = await makeOrg();
    await rejects(db.role.create({ data: { organizationId: org.id, key: "admin", name: "dup" } }));
    expect(await db.role.count({ where: { organizationId: org.id } })).toBe(7);
  });
});
