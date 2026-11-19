// Runs against the throw-away database (pnpm test:db).
import { describe, expect, it } from "vitest";
import { confirmNewsletter, hashToken, subscribeNewsletter, unsubscribeNewsletter } from "../src/newsletter";
import { db, id } from "./helpers";

const mail = () => `${id("n")}@example.test`;

describe("newsletter double opt-in", () => {
  it("stores only hashes, confirms once, then unsubscribes", async () => {
    const email = mail();
    const s = await subscribeNewsletter(db, email.toUpperCase());
    expect(s.action).toBe("send_confirmation");
    const row = await db.newsletterSubscriber.findUniqueOrThrow({ where: { email } });
    expect(row.status).toBe("PENDING");
    if (s.action !== "send_confirmation") throw new Error("unreachable");
    expect(row.confirmTokenHash).toBe(hashToken(s.confirmToken));
    expect(row.confirmTokenHash).not.toBe(s.confirmToken);

    const c = await confirmNewsletter(db, s.confirmToken);
    expect(c).toMatchObject({ ok: true, email });
    expect(await confirmNewsletter(db, s.confirmToken)).toMatchObject({ ok: false, reason: "invalid" });
    if (!c.ok) throw new Error("unreachable");

    expect(await unsubscribeNewsletter(db, c.unsubscribeToken)).toEqual({ ok: true });
    expect(await unsubscribeNewsletter(db, c.unsubscribeToken)).toEqual({ ok: true });
    expect((await db.newsletterSubscriber.findUniqueOrThrow({ where: { email } })).status).toBe("UNSUBSCRIBED");
  });
  it("an unconfirmed token expires after 7 days", async () => {
    const email = mail();
    const s = await subscribeNewsletter(db, email, new Date(Date.now() - 8 * 86_400_000));
    if (s.action !== "send_confirmation") throw new Error("unreachable");
    expect(await confirmNewsletter(db, s.confirmToken)).toMatchObject({ ok: false, reason: "expired" });
  });
  it("a confirmed address gets no new token; an unsubscribed one can start again", async () => {
    const email = mail();
    const s = await subscribeNewsletter(db, email);
    if (s.action !== "send_confirmation") throw new Error("unreachable");
    const c = await confirmNewsletter(db, s.confirmToken);
    expect(await subscribeNewsletter(db, email)).toEqual({ action: "none" });
    if (!c.ok) throw new Error("unreachable");
    await unsubscribeNewsletter(db, c.unsubscribeToken);
    expect((await subscribeNewsletter(db, email)).action).toBe("send_confirmation");
    expect((await db.newsletterSubscriber.findUniqueOrThrow({ where: { email } })).status).toBe("PENDING");
  });
  it("a wrong or oversized token does nothing", async () => {
    expect(await confirmNewsletter(db, "nope")).toMatchObject({ ok: false });
    expect(await confirmNewsletter(db, "x".repeat(500))).toMatchObject({ ok: false });
    expect(await unsubscribeNewsletter(db, "nope")).toEqual({ ok: false });
  });
});
