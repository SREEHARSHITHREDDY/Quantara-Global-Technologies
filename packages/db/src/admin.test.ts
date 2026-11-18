import { describe, expect, it } from "vitest";
import { EDITABLE_SETTINGS, validateSettings } from "./admin";

describe("validateSettings", () => {
  it("accepts valid values and trims them", () => {
    const r = validateSettings({ "contact.email": "  hello@example.com ", "social.linkedin": "https://www.linkedin.com/company/x" });
    expect(r.errors).toEqual({});
    expect(r.values["contact.email"]).toBe("hello@example.com");
  });
  it("rejects bad email, non-https URL, bad recipient list and over-long text", () => {
    const r = validateSettings({ "contact.email": "nope", "social.x": "http://x.com/a", "notifications.adminRecipients": "a@b.co, bad", "contact.address": "x".repeat(1001) });
    expect(Object.keys(r.errors).sort()).toEqual(["contact.address", "contact.email", "notifications.adminRecipients", "social.x"]);
  });
  it("accepts an empty string (meaning: remove the setting)", () => {
    expect(validateSettings({ "contact.email": "" }).values["contact.email"]).toBe("");
  });
  it("ignores keys that are not editable", () => {
    const r = validateSettings({ "evil.key": "x" } as never);
    expect(r.values).toEqual({}); expect(r.errors).toEqual({});
  });
  it("only publishes contact/company/social settings, never notification recipients", () => {
    expect(EDITABLE_SETTINGS.filter((s) => !s.isPublic).map((s) => s.key)).toEqual(["notifications.adminRecipients"]);
  });
});
