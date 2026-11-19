import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "./generated/client";

/** Raw tokens are only ever emailed; the database stores their SHA-256. */
export const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
export const CONFIRM_WINDOW_DAYS = 7;

export type SubscribeResult = { action: "send_confirmation"; confirmToken: string } | { action: "none" };

/**
 * Start (or restart) a subscription. Only a PENDING or UNSUBSCRIBED address gets a fresh confirmation token.
 * An already-confirmed or bounced address changes nothing, and the caller shows the same message either way,
 * so the form cannot be used to discover who is subscribed.
 */
export async function subscribeNewsletter(db: PrismaClient, emailRaw: string, now = new Date()): Promise<SubscribeResult> {
  const email = emailRaw.trim().toLowerCase();
  const existing = await db.newsletterSubscriber.findUnique({ where: { email }, select: { status: true } });
  if (existing && (existing.status === "CONFIRMED" || existing.status === "BOUNCED")) return { action: "none" };
  const raw = newToken();
  const data = { status: "PENDING" as const, confirmTokenHash: hashToken(raw), consentAt: now, unsubscribedAt: null, confirmedAt: null };
  if (existing) await db.newsletterSubscriber.update({ where: { email }, data });
  else await db.newsletterSubscriber.create({ data: { email, ...data } });
  return { action: "send_confirmation", confirmToken: raw };
}

export type ConfirmResult = { ok: true; email: string; unsubscribeToken: string } | { ok: false; reason: "invalid" | "expired" };

/** Confirm with the emailed token. The token works once; a fresh unsubscribe token is issued for the welcome email. */
export async function confirmNewsletter(db: PrismaClient, rawToken: string, now = new Date()): Promise<ConfirmResult> {
  if (!rawToken || rawToken.length > 200) return { ok: false, reason: "invalid" };
  const row = await db.newsletterSubscriber.findUnique({ where: { confirmTokenHash: hashToken(rawToken) }, select: { id: true, email: true, status: true, consentAt: true } });
  if (!row || row.status !== "PENDING") return { ok: false, reason: "invalid" };
  if (now.getTime() - row.consentAt.getTime() > CONFIRM_WINDOW_DAYS * 86_400_000) return { ok: false, reason: "expired" };
  const unsubscribeToken = newToken();
  const won = await db.newsletterSubscriber.updateMany({
    where: { id: row.id, status: "PENDING" },
    data: { status: "CONFIRMED", confirmedAt: now, confirmTokenHash: null, unsubscribeTokenHash: hashToken(unsubscribeToken) },
  });
  if (won.count === 0) return { ok: false, reason: "invalid" };
  return { ok: true, email: row.email, unsubscribeToken };
}

/** Unsubscribe with the emailed token. Safe to repeat: the token stays valid so a second click still reports success. */
export async function unsubscribeNewsletter(db: PrismaClient, rawToken: string, now = new Date()): Promise<{ ok: boolean }> {
  if (!rawToken || rawToken.length > 200) return { ok: false };
  const row = await db.newsletterSubscriber.findUnique({ where: { unsubscribeTokenHash: hashToken(rawToken) }, select: { id: true, status: true } });
  if (!row) return { ok: false };
  if (row.status === "CONFIRMED") await db.newsletterSubscriber.update({ where: { id: row.id }, data: { status: "UNSUBSCRIBED", unsubscribedAt: now } });
  return { ok: true };
}
