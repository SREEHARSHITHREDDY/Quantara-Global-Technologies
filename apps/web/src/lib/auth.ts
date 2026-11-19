import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuth, DisabledMailer, OutboxMailer, ResendMailer, type Auth, type Mailer } from "@quantara/auth";
import { getPrisma } from "@quantara/db";
import { ensureWorkspace } from "@/lib/workspace";
import { SITE_URL } from "@/lib/site";

const isProd = process.env.NODE_ENV === "production";

function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (isProd) throw new Error("BETTER_AUTH_SECRET must be set to a random value of at least 32 characters (openssl rand -base64 32)");
  return "dev-only-secret-not-for-production-use-0123456789abcdef"; // development only
}

/** Resend when configured; in development messages are printed to the server console; production without a provider fails loudly. */
export function buildMailer(): Mailer {
  const apiKey = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM;
  if (apiKey && from) return new ResendMailer({ apiKey, from });
  return isProd ? new DisabledMailer() : new OutboxMailer(true);
}

let instance: Auth | undefined;
/** Created on first use so builds and static pages never need a database. */
export function getAuth(): Auth {
  if (instance) return instance;
  const db = getPrisma();
  instance = createAuth({
    database: prismaAdapter(db, { provider: "postgresql" }),
    mailer: buildMailer(),
    secret: secret(),
    baseURL: process.env.BETTER_AUTH_URL ?? SITE_URL,
    production: isProd,
    onUserCreated: async (u) => { await ensureWorkspace(db, u); },
  });
  return instance;
}
