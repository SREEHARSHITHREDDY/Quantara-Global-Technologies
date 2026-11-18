import { describe, it, expect, beforeEach } from "vitest";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuth, type CreateAuthOptions, OutboxMailer, DisabledMailer, EmailNotConfiguredError, getMembershipContext, type AuthDb } from "./index";
import { can } from "@quantara/rbac";
import { secretFromOtpauthUri, totp } from "./testing";

const PASSWORD = "Correct-Horse-Battery-9";
function setup(mailer = new OutboxMailer(), extra: Partial<CreateAuthOptions> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: Record<string, any[]> = { user: [], session: [], account: [], verification: [], rateLimit: [], organization: [], member: [], invitation: [], twoFactor: [] };
  const auth = createAuth({ database: memoryAdapter(db), mailer, secret: "test-secret-test-secret-test-secret-123", baseURL: "http://localhost:3000", ...extra });
  return { auth, mailer, db };
}
const tokenFrom = (text: string) => new URL(text.match(/https?:\/\/\S+/)![0]).searchParams.get("token") ?? new URL(text.match(/https?:\/\/\S+/)![0]).pathname.split("/").pop()!;

describe("registration and email verification", () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => { s = setup(); });
  it("registers a user, sends a verification email, and blocks sign-in until verified", async () => {
    await s.auth.api.signUpEmail({ body: { email: "Ada@Example.com", password: PASSWORD, name: "Ada" } });
    expect(s.mailer.last("verify-email")?.to).toBe("ada@example.com");
    await expect(s.auth.api.signInEmail({ body: { email: "ada@example.com", password: PASSWORD } })).rejects.toThrow();
  });
  it("allows sign-in after the emailed link is used", async () => {
    await s.auth.api.signUpEmail({ body: { email: "ada@example.com", password: PASSWORD, name: "Ada" } });
    await s.auth.api.verifyEmail({ query: { token: tokenFrom(s.mailer.last("verify-email")!.text) } });
    const res = await s.auth.api.signInEmail({ body: { email: "ada@example.com", password: PASSWORD } });
    expect(res.user.email).toBe("ada@example.com");
  });
  it("rejects weak (short) passwords", async () => {
    await expect(s.auth.api.signUpEmail({ body: { email: "b@example.com", password: "short1", name: "B" } })).rejects.toThrow();
  });
  it("hashes passwords with argon2id (never stores plaintext)", async () => {
    await s.auth.api.signUpEmail({ body: { email: "c@example.com", password: PASSWORD, name: "C" } });
    const acct = s.db.account![0] as { password: string };
    expect(acct.password).toMatch(/^\$argon2id\$/); expect(acct.password).not.toContain(PASSWORD);
  });
  it("wrong password is rejected", async () => {
    await s.auth.api.signUpEmail({ body: { email: "d@example.com", password: PASSWORD, name: "D" } });
    await s.auth.api.verifyEmail({ query: { token: tokenFrom(s.mailer.last("verify-email")!.text) } });
    await expect(s.auth.api.signInEmail({ body: { email: "d@example.com", password: "Wrong-Password-123" } })).rejects.toThrow();
  });
});

describe("password reset", () => {
  it("emails a reset link, resets the password, and the old password stops working", async () => {
    const s = setup();
    await s.auth.api.signUpEmail({ body: { email: "e@example.com", password: PASSWORD, name: "E" } });
    await s.auth.api.verifyEmail({ query: { token: tokenFrom(s.mailer.last("verify-email")!.text) } });
    await s.auth.api.requestPasswordReset({ body: { email: "e@example.com", redirectTo: "http://localhost:3000/reset" } });
    const token = tokenFrom(s.mailer.last("reset-password")!.text);
    await s.auth.api.resetPassword({ body: { newPassword: "Brand-New-Password-77", token } });
    await expect(s.auth.api.signInEmail({ body: { email: "e@example.com", password: PASSWORD } })).rejects.toThrow();
    expect((await s.auth.api.signInEmail({ body: { email: "e@example.com", password: "Brand-New-Password-77" } })).user.email).toBe("e@example.com");
  });
  it("does not reveal whether an email exists", async () => {
    const s = setup();
    const r = await s.auth.api.requestPasswordReset({ body: { email: "nobody@example.com", redirectTo: "http://localhost:3000/reset" } });
    expect(r.status).toBe(true); expect(s.mailer.outbox).toHaveLength(0);
  });
});

describe("email provider failure handling", () => {
  it("DisabledMailer fails loudly rather than pretending to send", async () => {
    await expect(new DisabledMailer().send()).rejects.toBeInstanceOf(EmailNotConfiguredError);
  });
});

describe("authorization context resolution (fake DB)", () => {
  const mk = (over: Partial<{ role: string | null; type: "STAFF" | "CLIENT"; status: "ACTIVE" | "SUSPENDED"; banned: boolean; banExpires: Date | null }> = {}): AuthDb => ({
    member: { findUnique: async () => (over.role === null ? null : { role: over.role ?? "council_user" }) },
    organization: { findUnique: async () => ({ type: over.type ?? "CLIENT", status: over.status ?? "ACTIVE" }) },
    user: { findUnique: async () => ({ banned: over.banned ?? false, banExpires: over.banExpires ?? null }) },
  });
  it("non-members get null (deny)", async () => { expect(await getMembershipContext(mk({ role: null }), "u", "o")).toBeNull(); });
  it("members resolve to a context that drives can()", async () => {
    const ctx = await getMembershipContext(mk({ role: "council_user" }), "u", "o"); expect(can(ctx, "council:use")).toBe(true); expect(can(ctx, "audit:read")).toBe(false);
  });
  it("suspended users and organizations are denied", async () => {
    expect(can(await getMembershipContext(mk({ banned: true }), "u", "o"), "council:use")).toBe(false);
    expect(can(await getMembershipContext(mk({ status: "SUSPENDED" }), "u", "o"), "council:use")).toBe(false);
  });
  it("an expired ban no longer blocks", async () => {
    const ctx = await getMembershipContext(mk({ banned: true, banExpires: new Date(Date.now() - 1000) }), "u", "o"); expect(can(ctx, "council:use")).toBe(true);
  });
});

// ───────────── MFA, suspension, sessions, invitations ─────────────
async function verifiedSession(s: ReturnType<typeof setup>, email: string) {
  await s.auth.api.signUpEmail({ body: { email, password: PASSWORD, name: email.split("@")[0]! } });
  await s.auth.api.verifyEmail({ query: { token: tokenFrom(s.mailer.last("verify-email")!.text) } });
  const res = await s.auth.api.signInEmail({ body: { email, password: PASSWORD }, returnHeaders: true });
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return { headers: new Headers({ cookie }), user: res.response.user };
}

describe("MFA (TOTP)", () => {
  it("enrolment returns a TOTP URI + backup codes and stays disabled until a code is verified", async () => {
    const s = setup(); const { headers } = await verifiedSession(s, "mfa@example.com");
    const r = await s.auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers });
    if (r.method !== "totp") throw new Error("expected totp enrolment");
    expect(r.totpURI).toMatch(/^otpauth:\/\/totp\//); expect(r.backupCodes.length).toBeGreaterThanOrEqual(8);
    expect((s.db.user![0] as { twoFactorEnabled?: boolean }).twoFactorEnabled).toBeFalsy();
    await expect(s.auth.api.verifyTOTP({ body: { code: "000000" }, headers })).rejects.toThrow();
  });
});

describe("account suspension", () => {
  it("a banned user cannot sign in", async () => {
    const s = setup(); await verifiedSession(s, "ban@example.com");
    (s.db.user![0] as { banned: boolean; banReason: string }).banned = true; (s.db.user![0] as { banReason: string }).banReason = "policy";
    await expect(s.auth.api.signInEmail({ body: { email: "ban@example.com", password: PASSWORD } })).rejects.toThrow();
  });
});

describe("session management", () => {
  it("lists active sessions and revoking one invalidates it", async () => {
    const s = setup(); const { headers } = await verifiedSession(s, "sess@example.com");
    const list = await s.auth.api.listSessions({ headers }); expect(list.length).toBe(1);
    await s.auth.api.revokeSession({ body: { token: list[0]!.token }, headers });
    await expect(s.auth.api.listSessions({ headers })).rejects.toThrow();
  });
  it("sessions expire after 8 hours", async () => {
    const s = setup(); await verifiedSession(s, "exp@example.com");
    const sess = s.db.session![0] as { expiresAt: Date; createdAt: Date };
    const hours = (sess.expiresAt.getTime() - sess.createdAt.getTime()) / 3_600_000; expect(hours).toBeGreaterThan(7.9); expect(hours).toBeLessThanOrEqual(8.01);
  });
});

describe("organization invitations", () => {
  it("an org admin invites a user, an invitation email is sent, and the invitee can accept and becomes a member", async () => {
    const s = setup(); const owner = await verifiedSession(s, "owner@example.com");
    const org = await s.auth.api.createOrganization({ body: { name: "Acme Corp", slug: "acme-corp" }, headers: owner.headers });
    await s.auth.api.createInvitation({ body: { email: "guest@example.com", role: "council_user" as never, organizationId: org.id }, headers: owner.headers });
    const mail = s.mailer.last("invitation")!; expect(mail.to).toBe("guest@example.com");
    const guest = await verifiedSession(s, "guest@example.com");
    const invitationId = mail.text.match(/accept-invitation\/(\S+)/)![1]!;
    await s.auth.api.acceptInvitation({ body: { invitationId }, headers: guest.headers });
    expect((s.db.member! as { userId: string; role: string }[]).some((m) => m.userId === guest.user.id && m.role === "council_user")).toBe(true);
  });
  it("a plain council_user cannot invite others", async () => {
    const s = setup(); const owner = await verifiedSession(s, "o2@example.com");
    const org = await s.auth.api.createOrganization({ body: { name: "Beta Ltd", slug: "beta-ltd" }, headers: owner.headers });
    await s.auth.api.createInvitation({ body: { email: "peer@example.com", role: "council_user" as never, organizationId: org.id }, headers: owner.headers });
    const peer = await verifiedSession(s, "peer@example.com");
    await s.auth.api.acceptInvitation({ body: { invitationId: s.mailer.last("invitation")!.text.match(/accept-invitation\/(\S+)/)![1]! }, headers: peer.headers });
    await expect(s.auth.api.createInvitation({ body: { email: "x@example.com", role: "council_user" as never, organizationId: org.id }, headers: peer.headers })).rejects.toThrow();
  });
});

describe("ResendMailer", () => {
  it("posts the message to the Resend API with the key in the Authorization header", async () => {
    const { ResendMailer } = await import("./mailer");
    let seen: { url: string; init: RequestInit } | undefined;
    const m = new ResendMailer({ apiKey: "re_test", from: "Quantara <no-reply@example.test>", fetchImpl: (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response("{}", { status: 200 }); }) as never });
    await m.send({ to: "a@b.test", subject: "S", text: "T", kind: "other" });
    expect(seen?.url).toBe("https://api.resend.com/emails");
    expect((seen?.init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(String(seen?.init.body))).toEqual({ from: "Quantara <no-reply@example.test>", to: ["a@b.test"], subject: "S", text: "T" });
  });
  it("throws without leaking the response body when the provider rejects", async () => {
    const { ResendMailer } = await import("./mailer");
    const m = new ResendMailer({ apiKey: "k", from: "f@x.test", fetchImpl: (async () => new Response("secret@leak.test", { status: 422 })) as never });
    await expect(m.send({ to: "a@b.test", subject: "S", text: "T", kind: "other" })).rejects.toThrow(/HTTP 422/);
    await expect(m.send({ to: "a@b.test", subject: "S", text: "T", kind: "other" })).rejects.not.toThrow(/leak/);
  });
  it("refuses to be built without credentials", async () => {
    const { ResendMailer } = await import("./mailer");
    expect(() => new ResendMailer({ apiKey: "", from: "f@x.test" })).toThrow();
    expect(() => new ResendMailer({ apiKey: "k", from: "" })).toThrow();
  });
});

describe("onUserCreated hook", () => {
  it("runs after sign-up with the new user", async () => {
    const created: string[] = [];
    const s = setup(new OutboxMailer(), { onUserCreated: async (u) => { created.push(u.email); } });
    await s.auth.api.signUpEmail({ body: { email: "hook@example.test", password: PASSWORD, name: "Hook" } });
    expect(created).toEqual(["hook@example.test"]);
  });
  it("surfaces a failing hook to the caller (the handler must therefore be idempotent)", async () => {
    const s = setup(new OutboxMailer(), { onUserCreated: async () => { throw new Error("workspace failed"); } });
    await expect(s.auth.api.signUpEmail({ body: { email: "hook2@example.test", password: PASSWORD, name: "H" } })).rejects.toThrow();
  });
});

describe("MFA full cycle (TOTP, backup codes, disable)", () => {
  async function enrolled() {
    const s = setup(); const { headers } = await verifiedSession(s, "full@example.com");
    const r = await s.auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers });
    if (r.method !== "totp") throw new Error("expected totp");
    const secret = secretFromOtpauthUri(r.totpURI);
    // Activating two-factor rotates the session: continue with the fresh cookie, as a browser would.
    const v = await s.auth.api.verifyTOTP({ body: { code: totp(secret) }, headers, returnHeaders: true });
    return { s, headers: new Headers({ cookie: v.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") }), secret, backupCodes: r.backupCodes };
  }
  const cookieOf = (h: Headers) => new Headers({ cookie: h.getSetCookie().map((c) => c.split(";")[0]).join("; ") });

  it("a correct authenticator code activates two-factor; a wrong code does not", async () => {
    const s = setup(); const { headers } = await verifiedSession(s, "act@example.com");
    const r = await s.auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers });
    if (r.method !== "totp") throw new Error("expected totp");
    await expect(s.auth.api.verifyTOTP({ body: { code: "000000" }, headers })).rejects.toThrow();
    expect((s.db.user![0] as { twoFactorEnabled?: boolean }).twoFactorEnabled).toBeFalsy();
    await s.auth.api.verifyTOTP({ body: { code: totp(secretFromOtpauthUri(r.totpURI)) }, headers });
    expect((s.db.user![0] as { twoFactorEnabled?: boolean }).twoFactorEnabled).toBe(true);
  });
  it("after activation, password sign-in alone yields no session and demands a code", async () => {
    const { s } = await enrolled();
    const r = await s.auth.api.signInEmail({ body: { email: "full@example.com", password: PASSWORD }, returnHeaders: true });
    expect((r.response as { twoFactorRedirect?: boolean }).twoFactorRedirect).toBe(true);
    const sessionCookie = r.headers.getSetCookie().find((c) => c.startsWith("better-auth.session_token="));
    expect(sessionCookie === undefined || /^better-auth\.session_token=;/.test(sessionCookie)).toBe(true); // cleared, not issued
    expect(s.db.session!.length).toBe(1); // no new session was created
  });
  it("activating two-factor replaces the session cookie used to enrol", async () => {
    const s = setup(); const { headers } = await verifiedSession(s, "rot@example.com");
    const e = await s.auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers });
    if (e.method !== "totp") throw new Error("expected totp");
    await s.auth.api.verifyTOTP({ body: { code: totp(secretFromOtpauthUri(e.totpURI)) }, headers });
    await expect(s.auth.api.listSessions({ headers })).rejects.toThrow(); // old cookie no longer valid
  });
  it("sign-in completes with a valid code, and rejects a wrong one", async () => {
    const { s, secret } = await enrolled();
    const r = await s.auth.api.signInEmail({ body: { email: "full@example.com", password: PASSWORD }, returnHeaders: true });
    const pending = cookieOf(r.headers);
    await expect(s.auth.api.verifyTOTP({ body: { code: "000000" }, headers: pending })).rejects.toThrow();
    const ok = await s.auth.api.verifyTOTP({ body: { code: totp(secret) }, headers: pending, returnHeaders: true });
    expect(ok.response.user.email).toBe("full@example.com");
    expect(ok.headers.getSetCookie().some((c) => c.startsWith("better-auth.session_token="))).toBe(true);
  });
  it("a backup code signs in once and cannot be reused", async () => {
    const { s, backupCodes } = await enrolled();
    const first = await s.auth.api.signInEmail({ body: { email: "full@example.com", password: PASSWORD }, returnHeaders: true });
    const ok = await s.auth.api.verifyBackupCode({ body: { code: backupCodes[0]! }, headers: cookieOf(first.headers) });
    expect(ok.user.email).toBe("full@example.com");
    const second = await s.auth.api.signInEmail({ body: { email: "full@example.com", password: PASSWORD }, returnHeaders: true });
    await expect(s.auth.api.verifyBackupCode({ body: { code: backupCodes[0]! }, headers: cookieOf(second.headers) })).rejects.toThrow();
  });
  it("disabling two-factor needs the password, then password sign-in works again", async () => {
    const { s, headers } = await enrolled();
    await expect(s.auth.api.disableTwoFactor({ body: { password: "Wrong-Password-123" }, headers })).rejects.toThrow();
    await s.auth.api.disableTwoFactor({ body: { password: PASSWORD }, headers });
    const r = await s.auth.api.signInEmail({ body: { email: "full@example.com", password: PASSWORD } });
    expect(r.user.email).toBe("full@example.com");
  });
});
