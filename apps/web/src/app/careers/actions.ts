"use server";
import { headers } from "next/headers";
import { createApplication, getPrisma, hitRateLimit } from "@quantara/db";
import { processApplication, type ApplicationState } from "@/server/application-service";
import { getResumeStorage } from "@/server/resume-storage";

function ipSalt(): string {
  const s = process.env.APP_IP_HASH_SALT;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("APP_IP_HASH_SALT must be set in production");
  return "dev-only-salt";
}

export async function submitApplication(_prev: ApplicationState, formData: FormData): Promise<ApplicationState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  try {
    const raw: Record<string, unknown> = {};
    formData.forEach((value, key) => { if (typeof value === "string") raw[key] = value; });
    const f = formData.get("resume");
    const file = f instanceof File && f.size > 0 ? { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } : null;
    const db = getPrisma();
    return await processApplication(raw, file, ip, {
      storage: getResumeStorage(),
      createApplication: (i) => createApplication(db, i),
      hitRateLimit: (k, w, l) => hitRateLimit(db, k, w, l),
      now: () => new Date(), ipSalt: ipSalt(),
    });
  } catch (e) {
    console.error("application submission failed:", e instanceof Error ? e.message : "unknown error"); // never log applicant data
    return { status: "error", message: "We could not save your application right now. Please try again in a few minutes." };
  }
}
