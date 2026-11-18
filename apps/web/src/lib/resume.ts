export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // the database allows up to 10 MB; the form accepts 5 MB

export interface ResumeKind { mime: string; ext: "pdf" | "docx" | "doc" }

/**
 * Identifies a resume by its CONTENT (first bytes), never by the filename or the browser-reported type,
 * which an attacker controls. Only PDF, DOCX and legacy DOC are accepted.
 */
export function sniffResume(bytes: Uint8Array): ResumeKind | null {
  const starts = (sig: number[]) => bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", ext: "pdf" };                 // %PDF-
  if (starts([0x50, 0x4b, 0x03, 0x04])) return { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" }; // PK.. (zip)
  if (starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return { mime: "application/msword", ext: "doc" };
  return null;
}

/** Keeps a readable name but drops anything that could be a path or control character. */
export function safeFilename(name: string, ext: string): string {
  const base = name.replace(/\.[^.]*$/, "").replace(/[^\p{L}\p{N}._ -]+/gu, "").replace(/\.{2,}/g, ".").replace(/\s+/g, " ").replace(/^[.\s-]+/, "").trim().slice(0, 80) || "resume";
  return `${base}.${ext}`;
}
