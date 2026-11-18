"use server";
import { headers } from "next/headers";
import { createEnquiry, getPrisma, hitRateLimit } from "@quantara/db";
import { processEnquiry, type EnquiryState } from "@/server/enquiry-service";

function ipSalt(): string {
  const s = process.env.APP_IP_HASH_SALT;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("APP_IP_HASH_SALT must be set in production");
  return "dev-only-salt";
}

export async function submitEnquiry(_prev: EnquiryState, formData: FormData): Promise<EnquiryState> {
  const h = await headers();
  // Behind a proxy/CDN, X-Forwarded-For must be set by a trusted hop (see deployment docs).
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  try {
    const raw: Record<string, unknown> = {};
    formData.forEach((value, key) => { raw[key] = value; });
    const db = getPrisma();
    return await processEnquiry(raw, { ip, userAgent: h.get("user-agent") ?? "" }, {
      createEnquiry: (i) => createEnquiry(db, i),
      hitRateLimit: (k, w, l) => hitRateLimit(db, k, w, l),
      now: () => new Date(),
      ipSalt: ipSalt(),
    });
  } catch (e) {
    console.error("enquiry submission failed:", e instanceof Error ? e.message : "unknown error"); // never log submitted data
    return { status: "error", message: "We could not save your enquiry right now. Please try again in a few minutes." };
  }
}
