import { createHash } from "node:crypto";
import { z } from "zod";

export type NewsletterState = { status: "idle" } | { status: "sent" } | { status: "error"; message: string };

export const NEWSLETTER_LIMITS = { perIpPerHour: 5, perEmailPerHour: 3, windowSeconds: 3600 } as const;

const schema = z.object({
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address"),
  consent: z.literal("on", { message: "Please tick the box to subscribe" }),
  website: z.string().max(0).optional(), // honeypot: real visitors leave it empty
});

export interface NewsletterDeps {
  subscribe(email: string): Promise<{ action: "send_confirmation"; confirmToken: string } | { action: "none" }>;
  send(msg: { to: string; subject: string; text: string; kind: "newsletter" }): Promise<void>;
  hitRateLimit(key: string, windowSeconds: number, limit: number): Promise<{ allowed: boolean }>;
  origin: string;
  ipSalt: string;
}

const hash = (salt: string, v: string) => createHash("sha256").update(`${salt}:${v}`).digest("hex");

/** Same answer whether or not the address was already subscribed, so the form cannot reveal who is on the list. */
export async function requestSubscription(raw: Record<string, unknown>, ctx: { ip: string }, deps: NewsletterDeps): Promise<NewsletterState> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check your details and try again." };
  const { email } = parsed.data;
  const ip = await deps.hitRateLimit(`newsletter:ip:${hash(deps.ipSalt, ctx.ip)}`, NEWSLETTER_LIMITS.windowSeconds, NEWSLETTER_LIMITS.perIpPerHour);
  const em = await deps.hitRateLimit(`newsletter:email:${hash(deps.ipSalt, email)}`, NEWSLETTER_LIMITS.windowSeconds, NEWSLETTER_LIMITS.perEmailPerHour);
  if (!ip.allowed || !em.allowed) return { status: "error", message: "Too many attempts. Please try again later." };
  const r = await deps.subscribe(email);
  if (r.action === "send_confirmation") {
    const link = `${deps.origin}/newsletter/confirm?token=${encodeURIComponent(r.confirmToken)}`;
    await deps.send({ to: email, kind: "newsletter", subject: "Confirm your Quantara subscription", text: `Please confirm that you want to receive Quantara Technologies updates:\n${link}\n\nThis link works for 7 days. If you did not ask for this, ignore this email and nothing will be sent to you.` });
  }
  return { status: "sent" };
}

export function welcomeEmail(origin: string, unsubscribeToken: string) {
  return { kind: "newsletter" as const, subject: "You are subscribed to Quantara updates", text: `Thank you for confirming. You will receive occasional updates from Quantara Technologies.\n\nTo stop receiving them at any time:\n${origin}/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}` };
}
