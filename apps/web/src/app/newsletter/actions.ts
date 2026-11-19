"use server";
import { headers } from "next/headers";
import { getPrisma, hitRateLimit, subscribeNewsletter } from "@quantara/db";
import { buildMailer } from "@/lib/auth";
import { siteBase } from "@/lib/seo";
import { requestSubscription, type NewsletterState } from "@/server/newsletter-service";

function ipSalt(): string {
  const s = process.env.APP_IP_HASH_SALT;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("APP_IP_HASH_SALT must be set in production");
  return "dev-only-salt";
}

export async function subscribe(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const raw: Record<string, unknown> = {};
  formData.forEach((v, k) => { raw[k] = v; });
  try {
    const db = getPrisma();
    const mailer = buildMailer();
    return await requestSubscription(raw, { ip }, {
      subscribe: (email) => subscribeNewsletter(db, email),
      send: (m) => mailer.send(m),
      hitRateLimit: (k, w, l) => hitRateLimit(db, k, w, l),
      origin: siteBase(), ipSalt: ipSalt(),
    });
  } catch (e) {
    console.error("newsletter signup failed:", e instanceof Error ? e.message : "unknown error"); // never log the address
    return { status: "error", message: "We could not complete your signup right now. Please try again later." };
  }
}
