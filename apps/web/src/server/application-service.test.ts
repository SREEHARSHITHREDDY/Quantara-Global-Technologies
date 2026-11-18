import { describe, expect, it, vi } from "vitest";
import { processApplication, type ApplicationDeps } from "./application-service";
import { LocalDiskStorage, type ResumeStorage } from "./resume-storage";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PDF = new TextEncoder().encode("%PDF-1.7 fake resume");
const NOW = new Date("2026-11-18T10:00:00Z");
const good = (over: Record<string, unknown> = {}) => ({ jobId: "job1", applicantName: "Asha Rao", applicantEmail: "Asha@Example.com", privacyConsent: "on", startedAt: String(NOW.getTime() - 60_000), ...over });

function deps(over: Partial<ApplicationDeps> = {}) {
  const store = new Map<string, Uint8Array>();
  const storage: ResumeStorage = { put: async (b) => { const k = `k${store.size + 1}`; store.set(k, b); return k; }, get: async (k) => store.get(k) ?? null, remove: async (k) => { store.delete(k); } };
  const create = vi.fn(async () => ({ referenceId: "QNT-APP-X", duplicate: false }));
  const d: ApplicationDeps = { storage, createApplication: create, hitRateLimit: async () => ({ allowed: true }), now: () => NOW, ipSalt: "s", ...over };
  return { d, store, create };
}

describe("processApplication", () => {
  it("stores the file and the application, lower-casing the email", async () => {
    const { d, store, create } = deps();
    const r = await processApplication(good(), { name: "My CV (final).pdf", bytes: PDF }, "1.1.1.1", d);
    expect(r).toEqual({ status: "success", referenceId: "QNT-APP-X", duplicate: false });
    expect(store.size).toBe(1);
    const arg = (create.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(arg).toMatchObject({ applicantEmail: "asha@example.com", resumeMimeType: "application/pdf", resumeFilename: "My CV final.pdf", resumeSizeBytes: PDF.length });
    expect(arg.resumeSha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("rejects a file whose content is not a PDF/Word document even if named .pdf", async () => {
    const { d, store } = deps();
    const r = await processApplication(good(), { name: "evil.pdf", bytes: new TextEncoder().encode("<script>alert(1)</script>") }, "ip", d);
    expect(r).toMatchObject({ status: "error", fieldErrors: { resume: [expect.stringMatching(/PDF or Word/)] } }); expect(store.size).toBe(0);
  });
  it("rejects a missing resume and one over 5 MB", async () => {
    expect(await processApplication(good(), null, "ip", deps().d)).toMatchObject({ status: "error", fieldErrors: { resume: ["Attach your resume"] } });
    const big = new Uint8Array(5 * 1024 * 1024 + 1); big.set(PDF);
    expect(await processApplication(good(), { name: "a.pdf", bytes: big }, "ip", deps().d)).toMatchObject({ status: "error", fieldErrors: { resume: [expect.stringMatching(/5 MB/)] } });
  });
  it("requires consent, a valid email and a name", async () => {
    const r = await processApplication(good({ privacyConsent: undefined, applicantEmail: "nope", applicantName: "" }), { name: "a.pdf", bytes: PDF }, "ip", deps().d);
    expect(r).toMatchObject({ status: "error" });
    expect(Object.keys((r as { fieldErrors: object }).fieldErrors).sort()).toEqual(["applicantEmail", "applicantName", "privacyConsent"]);
  });
  it("silently drops honeypot and too-fast submissions without storing anything", async () => {
    for (const raw of [good({ website: "http://spam" }), good({ startedAt: String(NOW.getTime() - 500) })]) {
      const { d, store, create } = deps();
      expect((await processApplication(raw, { name: "a.pdf", bytes: PDF }, "ip", d)).status).toBe("success");
      expect(store.size).toBe(0); expect(create).not.toHaveBeenCalled();
    }
  });
  it("applies per-IP and per-email limits", async () => {
    const ipBlocked = deps({ hitRateLimit: async (k) => ({ allowed: !k.startsWith("apply:ip:") }) });
    expect(await processApplication(good(), { name: "a.pdf", bytes: PDF }, "ip", ipBlocked.d)).toMatchObject({ status: "error", message: expect.stringMatching(/Too many/) });
    const emailBlocked = deps({ hitRateLimit: async (k) => ({ allowed: !k.startsWith("apply:email:") }) });
    expect(await processApplication(good(), { name: "a.pdf", bytes: PDF }, "ip", emailBlocked.d)).toMatchObject({ status: "error", message: expect.stringMatching(/several applications/) });
    expect(emailBlocked.store.size).toBe(0);
  });
  it("removes the stored file on a duplicate application and when saving fails", async () => {
    const dup = deps({ createApplication: async () => ({ referenceId: "QNT-APP-OLD", duplicate: true }) });
    expect(await processApplication(good(), { name: "a.pdf", bytes: PDF }, "ip", dup.d)).toMatchObject({ status: "success", duplicate: true }); expect(dup.store.size).toBe(0);
    const boom = deps({ createApplication: async () => { throw new Error("db down"); } });
    await expect(processApplication(good(), { name: "a.pdf", bytes: PDF }, "ip", boom.d)).rejects.toThrow("db down"); expect(boom.store.size).toBe(0);
  });
  it("refuses applications when no storage is configured", async () => {
    expect(await processApplication(good(), { name: "a.pdf", bytes: PDF }, "ip", deps({ storage: null }).d)).toMatchObject({ status: "error", message: expect.stringMatching(/unavailable/) });
  });
});

describe("LocalDiskStorage", () => {
  it("round-trips bytes under a generated key and rejects path traversal", async () => {
    const dir = await mkdtemp(join(tmpdir(), "resumes-")); const s = new LocalDiskStorage(dir);
    const key = await s.put(PDF);
    expect(key).toMatch(/^[0-9a-f-]{36}$/); expect(await s.get(key)).toEqual(PDF);
    await expect(s.get("../../etc/passwd")).rejects.toThrow(/Invalid storage key/);
    await s.remove(key); expect(await s.get(key)).toBeNull(); expect(await readdir(dir)).toEqual([]);
  });
});
