import { betterAuth } from "better-auth";
import { admin, organization, twoFactor } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { hash, verify } from "@node-rs/argon2";
import { ROLE_KEYS, type RoleKey } from "@quantara/rbac";
import type { Mailer } from "./mailer";

export * from "./mailer";
export * from "./context";

export interface CreateAuthOptions {
  /** A Better Auth database adapter (prismaAdapter(prisma,{provider:"postgresql"}) in production, memoryAdapter in tests). */
  database: Parameters<typeof betterAuth>[0]["database"];
  mailer: Mailer;
  secret: string;
  baseURL: string;
  trustedOrigins?: string[];
  appName?: string;
  production?: boolean;
  /** Called right after a user row is created (e.g. to provision that customer's workspace). The row already exists when this runs, so the handler must be idempotent. */
  onUserCreated?: (user: { id: string; name: string; email: string }) => Promise<void>;
}

// Better Auth's own organization endpoints (invite/remove/update) are gated by this access-control map.
// Application authorization still goes through @quantara/rbac `can()`.
const ac = createAccessControl({ organization: ["update", "delete"], member: ["create", "update", "delete"], invitation: ["create", "cancel"] } as const);
const orgManager = ac.newRole({ organization: ["update"], member: ["create", "update", "delete"], invitation: ["create", "cancel"] });
const orgMember = ac.newRole({ organization: [], member: [], invitation: [] });
const orgRoles = Object.fromEntries(ROLE_KEYS.map((k: RoleKey) => [k, k === "super_admin" || k === "admin" ? orgManager : orgMember]));

// Argon2id with OWASP-recommended minimums (m=19MiB, t=2, p=1).
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1, algorithm: 2 as const };

export function createAuth(o: CreateAuthOptions) {
  const appName = o.appName ?? "Quantara";
  return betterAuth({
    appName,
    baseURL: o.baseURL,
    secret: o.secret,
    database: o.database,
    trustedOrigins: o.trustedOrigins ?? [o.baseURL],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,           // no session until the email is verified
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
      resetPasswordTokenExpiresIn: 60 * 60,      // 1 hour
      revokeSessionsOnPasswordReset: true,
      password: { hash: (p) => hash(p, ARGON), verify: ({ hash: h, password }) => verify(h, password) },
      sendResetPassword: async ({ user, url }) => { await o.mailer.send({ to: user.email, kind: "reset-password", subject: `Reset your ${appName} password`, text: `Use this link within 1 hour:\n${url}\nIf you did not request this, ignore this email.` }); },
    },
    emailVerification: {
      sendOnSignUp: true, autoSignInAfterVerification: false, expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => { await o.mailer.send({ to: user.email, kind: "verify-email", subject: `Verify your ${appName} email`, text: `Confirm your email address:\n${url}` }); },
    },
    session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 15, freshAge: 60 * 10, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, window: 60, max: 60, storage: "database",
      customRules: { "/sign-in/email": { window: 60, max: 5 }, "/request-password-reset": { window: 300, max: 3 }, "/sign-up/email": { window: 300, max: 5 }, "/two-factor/verify-totp": { window: 60, max: 5 } } },
    databaseHooks: o.onUserCreated ? { user: { create: { after: async (u: { id: string; name: string; email: string }) => { await o.onUserCreated!(u); } } } } : undefined,
    advanced: { useSecureCookies: !!o.production, defaultCookieAttributes: { sameSite: "lax", httpOnly: true } },
    plugins: [
      // user.role ("user" | "admin") ONLY gates Better Auth's ban/unban/session-revocation endpoints.
      // It is never used for application authorization: that comes from organization-scoped member.role via @quantara/rbac.
      admin({ defaultRole: "user" }),
      organization({
        ac, roles: orgRoles as never, creatorRole: "admin", invitationExpiresIn: 60 * 60 * 24 * 7, cancelPendingInvitationsOnReInvite: true,
        sendInvitationEmail: async (d) => { await o.mailer.send({ to: d.email, kind: "invitation", subject: `You're invited to ${d.organization.name} on ${appName}`, text: `${d.inviter.user.name} invited you as ${d.role}.\nAccept: ${o.baseURL}/accept-invitation/${d.id}` }); },
      }),
      twoFactor({ issuer: appName }),
    ],
  });
}
export type Auth = ReturnType<typeof createAuth>;
