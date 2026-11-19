import { describe, expect, it } from "vitest";
import { requestSubscription, welcomeEmail, type NewsletterDeps } from "./newsletter-service";

function deps(over: Partial<NewsletterDeps> = {}) {
  const sent: { to: string; text: string }[] = [];
  const d: NewsletterDeps = {
    subscribe: async () => ({ action: "send_confirmation", confirmToken: "tok/en" }),
    send: async (m) => { sent.push(m); },
    hitRateLimit: async () => ({ allowed: true }),
    origin: "https://site.test", ipSalt: "salt", ...over,
  };
  return { d, sent };
}
const form = { email: "A@Example.com", consent: "on" };

describe("newsletter signup", () => {
  it("emails a confirmation link built from the site origin and the encoded token", async () => {
    const { d, sent } = deps();
    expect(await requestSubscription(form, { ip: "1.1.1.1" }, d)).toEqual({ status: "sent" });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("a@example.com");
    expect(sent[0]!.text).toContain("https://site.test/newsletter/confirm?token=tok%2Fen");
  });
  it("gives the same answer and sends nothing for an address already subscribed", async () => {
    const { d, sent } = deps({ subscribe: async () => ({ action: "none" }) });
    expect(await requestSubscription(form, { ip: "1.1.1.1" }, d)).toEqual({ status: "sent" });
    expect(sent).toHaveLength(0);
  });
  it("needs a valid email and the consent box, and ignores the honeypot filler", async () => {
    const { d, sent } = deps();
    expect(await requestSubscription({ email: "nope", consent: "on" }, { ip: "i" }, d)).toMatchObject({ status: "error" });
    expect(await requestSubscription({ email: "a@b.co" }, { ip: "i" }, d)).toMatchObject({ status: "error" });
    expect(await requestSubscription({ ...form, website: "http://spam" }, { ip: "i" }, d)).toMatchObject({ status: "error" });
    expect(sent).toHaveLength(0);
  });
  it("stops when either rate limit is hit, before touching the database", async () => {
    let touched = false;
    const { d } = deps({ hitRateLimit: async (k) => ({ allowed: !k.startsWith("newsletter:email") }), subscribe: async () => { touched = true; return { action: "none" }; } });
    expect(await requestSubscription(form, { ip: "i" }, d)).toMatchObject({ status: "error" });
    expect(touched).toBe(false);
  });
  it("the welcome email carries the unsubscribe link", () => {
    expect(welcomeEmail("https://site.test", "u/t").text).toContain("https://site.test/newsletter/unsubscribe?token=u%2Ft");
  });
});
