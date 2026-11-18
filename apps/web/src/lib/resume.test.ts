import { describe, expect, it } from "vitest";
import { safeFilename, sniffResume } from "./resume";

const b = (...n: number[]) => new Uint8Array(n);
describe("sniffResume", () => {
  it("recognises PDF, DOCX and DOC by content", () => {
    expect(sniffResume(new TextEncoder().encode("%PDF-1.4"))?.ext).toBe("pdf");
    expect(sniffResume(b(0x50, 0x4b, 0x03, 0x04, 0))?.ext).toBe("docx");
    expect(sniffResume(b(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1))?.ext).toBe("doc");
  });
  it("rejects scripts, images, executables and empty input", () => {
    for (const x of [new TextEncoder().encode("<html>"), b(0x89, 0x50, 0x4e, 0x47), b(0x4d, 0x5a, 0x90), b()]) expect(sniffResume(x)).toBeNull();
  });
});
describe("safeFilename", () => {
  it("removes path parts and odd characters and forces the detected extension", () => {
    expect(safeFilename("../../etc/passwd.exe", "pdf")).toBe("etcpasswd.pdf");
    expect(safeFilename("Résumé – Asha <final>.docx", "docx")).toBe("Résumé Asha final.docx");
    expect(safeFilename("....", "pdf")).toBe("resume.pdf");
  });
});
