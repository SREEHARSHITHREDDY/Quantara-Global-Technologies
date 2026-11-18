import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

/** Private object storage for resumes. Keys are generated here, never taken from users. */
export interface ResumeStorage {
  put(bytes: Uint8Array): Promise<string>;
  get(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<void>;
}

const KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Files in a directory that is NOT served by the website. Suitable for development and single-server hosting. */
export class LocalDiskStorage implements ResumeStorage {
  private readonly dir: string;
  constructor(dir: string) { this.dir = resolve(dir); }
  private path(key: string): string {
    if (!KEY.test(key)) throw new Error("Invalid storage key"); // blocks path traversal
    return join(this.dir, key);
  }
  async put(bytes: Uint8Array): Promise<string> {
    const key = randomUUID();
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    await writeFile(this.path(key), bytes, { mode: 0o600, flag: "wx" });
    return key;
  }
  async get(key: string): Promise<Uint8Array | null> {
    try { return new Uint8Array(await readFile(this.path(key))); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; }
  }
  async remove(key: string): Promise<void> { await rm(this.path(key), { force: true }); }
}

/**
 * Production needs durable private storage. Until an S3-compatible bucket adapter is added (awaiting credentials),
 * set RESUME_STORAGE_DIR to a persistent private directory. Without it, production refuses to accept resumes.
 */
export function getResumeStorage(): ResumeStorage | null {
  const dir = process.env.RESUME_STORAGE_DIR;
  if (dir) return new LocalDiskStorage(dir);
  if (process.env.NODE_ENV === "production") return null;
  return new LocalDiskStorage(join(process.cwd(), ".data", "resumes")); // development only; .data is git-ignored
}
