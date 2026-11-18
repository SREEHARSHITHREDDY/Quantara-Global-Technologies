// End-to-end auth flows through Better Auth's PRISMA adapter against real PostgreSQL.
// Closes the "auth verified only on the in-memory adapter" gap. Unverified until run with `pnpm test:db`.
// Requires the RateLimit migration (see STATUS.md) because Better Auth's rate limiter stores counters in the `rateLimit` table.
import { describe, expect, it } from "vitest";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuth, getMembershipContext, OutboxMailer } from "@quantara/auth";
import { secretFromOtpauthUri, totp } from "@quantara/auth/testing";
import { can } from "@quantara/rbac";
import { ensureCustomerWorkspace } from "../src/workspace";
import { db, id } from "./helpers";

const PASSWORD = "Correct-Horse-Battery-9";
const cookies = (h: Headers) => new Headers({ cookie: h.getSetCookie().map((c) => c.split(";")[0]).join("; ") });
// Verification links carry ?token=; reset links carry the token as the last path segment.
const tokenFrom = (text: string) => { const u = new URL(text.match(/https?:\/\/\S+/)![0]); return u.searchParams.get("token") ?? u.pathname.split("/").pop()!; };

function app() {
  const mailer = new OutboxMailer();
  const auth = createAuth({
    database: prismaAdapter(db, { provider: "postgresql" }), mailer, secret: "integration-secret-integration-secret-123", baseURL: "http://localhost:3000",
    onUserCreated: async (u) => { await ensureCustomerWorkspace(db, u); },
  });
  return { auth, mailer };
}
async function signedUp(a: ReturnType<typeof app>, email = `${id("c")}@example.test`) {
  await a.auth.api.signUpEmail({ body: { email, password: PASSWORD, name: "Test Customer" } });
  return email;
}
async function verifiedSignIn(a: ReturnType<typeof app>, email: string) {
  await a.auth.api.verifyEmail({ query: { token: tokenFrom(a.mailer.last("verify-email")!.text) } });
  const r = await a.auth.api.signInEmail({ body: { email, password: PASSWORD }, returnHeaders: true });
  return { headers: cookies(r.headers), user: r.response.user };
}

describe("registration, verification and workspace (Prisma adapter)", () => {
  it("registers, emails a verification link, blocks sign-in until verified, then allows it", async () => {
    const a = app(); const email = await signedUp(a);
    expect(a.mailer.last("verify-email")?.to).toBe(email);
    expect((await db.user.findUniqueOrThrow({ where: { email } })).emailVerified).toBe(false);
    await expect(a.auth.api.signInEmail({ body: { email, password: PASSWORD } })).rejects.toThrow();
    const { user } = await verifiedSignIn(a, email);
    expect(user.email).toBe(email);
    expect((await db.user.findUniqueOrThrow({ where: { email } })).emailVerified).toBe(true);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
  });
  it("stores an argon2id hash, never the password", async () => {
    const a = app(); const email = await signedUp(a);
    const acct = await db.account.findFirstOrThrow({ where: { user: { email }, providerId: "credential" } });
    expect(acct.password).toMatch(/^\$argon2id\$/); expect(acct.password).not.toContain(PASSWORD);
  });
  it("gives the new customer exactly one workspace where they are admin, with correct permissions", async () => {
    const a = app(); const email = await signedUp(a); const { user } = await verifiedSignIn(a, email);
    const members = await db.member.findMany({ where: { userId: user.id }, include: { organization: true } });
    expect(members).toHaveLength(1); expect(members[0]?.role).toBe("admin"); expect(members[0]?.organization.type).toBe("CLIENT");
    const ctx = await getMembershipContext(db, user.id, members[0]!.organizationId);
    expect(ctx).toMatchObject({ role: "admin", orgType: "CLIENT", orgStatus: "ACTIVE", userBanned: false });
    expect(can(ctx!, "council:use")).toBe(true);
    expect(can(ctx!, "user:invite")).toBe(true);
    expect(can(ctx!, "site:settings:write")).toBe(false);   // platform permission: never valid in a CLIENT organization
    expect(can(ctx!, "ai:provider:manage")).toBe(false);
  });
  it("denies a suspended (banned) user at the authorization layer and at sign-in", async () => {
    const a = app(); const email = await signedUp(a); const { user } = await verifiedSignIn(a, email);
    await db.user.update({ where: { id: user.id }, data: { banned: true, banReason: "test" } });
    const org = (await db.member.findFirstOrThrow({ where: { userId: user.id } })).organizationId;
    expect(can((await getMembershipContext(db, user.id, org))!, "council:use")).toBe(false);
    await expect(a.auth.api.signInEmail({ body: { email, password: PASSWORD } })).rejects.toThrow();
  });
});

describe("password reset (Prisma adapter)", () => {
  it("emails a link, changes the password, revokes existing sessions, and the link works once", async () => {
    const a = app(); const email = await signedUp(a); const { user } = await verifiedSignIn(a, email);
    await a.auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" } });
    const token = tokenFrom(a.mailer.last("reset-password")!.text);
    const NEW = "Another-Strong-Pass-77";
    await a.auth.api.resetPassword({ body: { newPassword: NEW, token } });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    await expect(a.auth.api.signInEmail({ body: { email, password: PASSWORD } })).rejects.toThrow();
    expect((await a.auth.api.signInEmail({ body: { email, password: NEW } })).user.email).toBe(email);
    await expect(a.auth.api.resetPassword({ body: { newPassword: "Yet-Another-Pass-123", token } })).rejects.toThrow();
  });
  it("does not reveal whether an email is registered", async () => {
    const a = app(); const before = a.mailer.outbox.length;
    const r = await a.auth.api.requestPasswordReset({ body: { email: `${id("nobody")}@example.test`, redirectTo: "/reset-password" } });
    expect(r.status).toBe(true); expect(a.mailer.outbox.length).toBe(before);
  });
});

describe("two-factor authentication (Prisma adapter)", () => {
  it("enrols, activates with an authenticator code, then requires a code at sign-in; backup code works once", async () => {
    const a = app(); const email = await signedUp(a); const { headers } = await verifiedSignIn(a, email);
    const e = await a.auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers });
    if (e.method !== "totp") throw new Error("expected totp");
    const secret = secretFromOtpauthUri(e.totpURI);
    await a.auth.api.verifyTOTP({ body: { code: totp(secret) }, headers });
    expect((await db.user.findUniqueOrThrow({ where: { email } })).twoFactorEnabled).toBe(true);
    expect(await db.twoFactor.count({ where: { user: { email } } })).toBe(1);

    const si = await a.auth.api.signInEmail({ body: { email, password: PASSWORD }, returnHeaders: true });
    expect((si.response as { twoFactorRedirect?: boolean }).twoFactorRedirect).toBe(true);
    await expect(a.auth.api.verifyTOTP({ body: { code: "000000" }, headers: cookies(si.headers) })).rejects.toThrow();
    expect((await a.auth.api.verifyTOTP({ body: { code: totp(secret) }, headers: cookies(si.headers) })).user.email).toBe(email);

    const si2 = await a.auth.api.signInEmail({ body: { email, password: PASSWORD }, returnHeaders: true });
    expect((await a.auth.api.verifyBackupCode({ body: { code: e.backupCodes[0]! }, headers: cookies(si2.headers) })).user.email).toBe(email);
    const si3 = await a.auth.api.signInEmail({ body: { email, password: PASSWORD }, returnHeaders: true });
    await expect(a.auth.api.verifyBackupCode({ body: { code: e.backupCodes[0]! }, headers: cookies(si3.headers) })).rejects.toThrow();

  });
});

describe("rate limiting uses the database table", () => {
  it("blocks repeated sign-in attempts from one address with HTTP 429 and records the counter in rateLimit", async () => {
    const a = app(); const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    const attempt = () => a.auth.handler(new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip, origin: "http://localhost:3000" },
      body: JSON.stringify({ email: "nobody@example.test", password: "Wrong-Password-123" }),
    }));
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await attempt()).status);
    expect(statuses.slice(0, 5).every((s) => s !== 429)).toBe(true);
    expect(statuses.slice(5)).toEqual([429, 429]);
    expect(await db.rateLimit.count({ where: { key: { contains: ip } } })).toBeGreaterThan(0);
  });
});
