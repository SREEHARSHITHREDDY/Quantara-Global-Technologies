// Runs against the throw-away database (pnpm test:db).
import { describe, expect, it } from "vitest";
import { auditResumeDownload, createApplication, getApplication, getOpenJob, listApplications, listOpenJobs, saveJob, setApplicationStatus, type JobInput } from "../src/careers";
import { db, id, makeUser, rejects } from "./helpers";

const base = (over: Partial<JobInput> = {}): JobInput => ({ title: `Engineer ${id("t")}`, department: "Engineering", employmentType: "FULL_TIME", location: "Hyderabad", description: "Build things for enterprise clients.", responsibilities: ["a"], requirements: ["b"], status: "DRAFT", ...over });
const app = (jobId: string, email = `${id("a")}@Example.test`) => ({ jobId, applicantName: "Asha Rao", applicantEmail: email, resumeStorageKey: id("key"), resumeFilename: "cv.pdf", resumeMimeType: "application/pdf", resumeSizeBytes: 1234, resumeSha256: "a".repeat(64) });
async function publishedJob(over: Partial<JobInput> = {}) {
  const r = await saveJob(db, undefined, base({ status: "PUBLISHED", ...over }), (await makeUser()).id, null, true);
  if (!r.ok) throw new Error(r.error); return r;
}

describe("public jobs", () => {
  it("shows only published, not-yet-closed jobs", async () => {
    const now = new Date("2026-11-18T10:00:00Z");
    const open = await publishedJob({ closesAt: new Date("2027-01-01T00:00:00Z") });
    const noClose = await publishedJob();
    const closed = await publishedJob({ closesAt: new Date("2026-11-01T00:00:00Z") });
    const u = await makeUser(); const draft = await saveJob(db, undefined, base(), u.id, null, true);
    const slugs = (await listOpenJobs(db, now)).map((j) => j.slug);
    expect(slugs).toContain(open.slug); expect(slugs).toContain(noClose.slug);
    expect(slugs).not.toContain(closed.slug); if (draft.ok) expect(slugs).not.toContain(draft.slug);
    expect(await getOpenJob(db, closed.slug, now)).toBeNull();
    expect((await getOpenJob(db, open.slug, now))?.title).toBeTruthy();
  });
});

describe("saveJob", () => {
  it("creates a slug from the title, sets postedAt on first publish and keeps it afterwards", async () => {
    const u = await makeUser(); const title = `Senior Data Engineer ${id("x")}`;
    const draft = await saveJob(db, undefined, base({ title }), u.id, null, true);
    if (!draft.ok) throw new Error(draft.error);
    expect(draft.slug).toMatch(/^senior-data-engineer-x-/);
    expect((await db.job.findUniqueOrThrow({ where: { id: draft.id } })).postedAt).toBeNull();
    const t1 = new Date("2026-11-18T00:00:00Z"), t2 = new Date("2026-12-01T00:00:00Z");
    await saveJob(db, draft.id, base({ title, slug: draft.slug, status: "PUBLISHED" }), u.id, null, true, t1);
    await saveJob(db, draft.id, base({ title, slug: draft.slug, status: "PUBLISHED", location: "Remote" }), u.id, null, true, t2);
    const row = await db.job.findUniqueOrThrow({ where: { id: draft.id } });
    expect(row.postedAt?.toISOString()).toBe(t1.toISOString()); expect(row.location).toBe("Remote");
  });
  it("blocks publishing without permission, and editing a published job without permission", async () => {
    const u = await makeUser();
    expect(await saveJob(db, undefined, base({ status: "PUBLISHED" }), u.id, null, false)).toMatchObject({ ok: false, error: expect.stringMatching(/permission to publish/) });
    const pub = await publishedJob();
    expect(await saveJob(db, pub.id, base({ slug: pub.slug, status: "DRAFT" }), u.id, null, false)).toMatchObject({ ok: false });
    expect(await saveJob(db, undefined, base(), u.id, null, false)).toMatchObject({ ok: true });
  });
  it("rejects a duplicate slug and records an audit entry", async () => {
    const u = await makeUser(); const a = await saveJob(db, undefined, base({ slug: id("same") }), u.id, null, true);
    if (!a.ok) throw new Error(a.error);
    expect(await saveJob(db, undefined, base({ slug: a.slug }), u.id, null, true)).toMatchObject({ ok: false, error: expect.stringMatching(/slug/) });
    expect(await db.auditLog.count({ where: { action: "job.created", resourceId: a.id, actorId: u.id } })).toBe(1);
  });
});

describe("applications", () => {
  it("stores an application with a first status event and a lower-case email", async () => {
    const job = await publishedJob(); const email = `${id("A")}@Example.TEST`;
    const r = await createApplication(db, app(job.id, email));
    expect(r.duplicate).toBe(false); expect(r.referenceId).toMatch(/^QNT-APP-\d{8}-[A-Z2-9]{6}$/);
    const row = await db.jobApplication.findUniqueOrThrow({ where: { referenceId: r.referenceId }, include: { events: true } });
    expect(row.applicantEmail).toBe(email.toLowerCase()); expect(row.status).toBe("RECEIVED"); expect(row.events).toHaveLength(1);
  });
  it("reports a repeat application from the same email instead of creating a second row, including concurrently", async () => {
    const job = await publishedJob(); const email = `${id("d")}@example.test`;
    const out = await Promise.all([1, 2, 3].map(() => createApplication(db, app(job.id, email))));
    expect(out.filter((o) => !o.duplicate)).toHaveLength(1); expect(new Set(out.map((o) => o.referenceId)).size).toBe(1);
    expect(await db.jobApplication.count({ where: { jobId: job.id, applicantEmail: email } })).toBe(1);
  });
  it("refuses applications to closed or draft jobs", async () => {
    const closed = await publishedJob({ closesAt: new Date("2026-01-01T00:00:00Z") });
    await expect(createApplication(db, app(closed.id))).rejects.toThrow(/no longer open/);
    const u = await makeUser(); const d = await saveJob(db, undefined, base(), u.id, null, true); if (!d.ok) throw new Error();
    await expect(createApplication(db, app(d.id))).rejects.toThrow(/no longer open/);
  });
  it("the database itself rejects an oversized resume and missing consent", async () => {
    const job = await publishedJob();
    await rejects(db.jobApplication.create({ data: { referenceId: id("R"), jobId: job.id, applicantName: "x", applicantEmail: `${id("o")}@example.test`, resumeStorageKey: "k", resumeFilename: "a.pdf", resumeMimeType: "application/pdf", resumeSizeBytes: 10_485_761, resumeSha256: "a", privacyConsent: true, consentAt: new Date() } }), /resume_size|check/i);
    await rejects(db.jobApplication.create({ data: { referenceId: id("R"), jobId: job.id, applicantName: "x", applicantEmail: `${id("o")}@example.test`, resumeStorageKey: "k", resumeFilename: "a.pdf", resumeMimeType: "application/pdf", resumeSizeBytes: 10, resumeSha256: "a", privacyConsent: false, consentAt: new Date() } }), /consent|check/i);
  });
  it("lists by job and status, changes status with history and audit, and audits resume downloads", async () => {
    const job = await publishedJob(); const actor = await makeUser();
    const a = await createApplication(db, app(job.id)); const b = await createApplication(db, app(job.id));
    const rowA = await db.jobApplication.findUniqueOrThrow({ where: { referenceId: a.referenceId } });
    expect(await setApplicationStatus(db, rowA.id, "SHORTLISTED", "Strong profile", actor.id, null)).toBe(true);
    const list = await listApplications(db, { jobId: job.id, status: "SHORTLISTED" });
    expect(list.items.map((i) => i.referenceId)).toEqual([a.referenceId]); expect(list.total).toBe(1);
    expect((await listApplications(db, { jobId: job.id })).total).toBe(2); expect(b.referenceId).not.toBe(a.referenceId);
    const full = await getApplication(db, rowA.id);
    expect(full?.events.map((e: { toStatus: string }) => e.toStatus)).toEqual(["RECEIVED", "SHORTLISTED"]);
    expect(full?.events[1]?.note).toBe("Strong profile");
    expect(await db.auditLog.count({ where: { action: "application.status.changed", resourceId: rowA.id } })).toBe(1);
    await auditResumeDownload(db, rowA.id, actor.id, null);
    expect(await db.auditLog.count({ where: { action: "application.resume.downloaded", resourceId: rowA.id, actorId: actor.id } })).toBe(1);
    expect(await setApplicationStatus(db, "00000000-0000-7000-8000-000000000000", "HIRED", undefined, actor.id, null)).toBe(false);
    await expect(setApplicationStatus(db, rowA.id, "BOGUS" as never, undefined, actor.id, null)).rejects.toThrow(/Invalid/);
  });
});
