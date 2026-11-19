import { describe, expect, it } from "vitest";
import { telHref, toSiteContact } from "./site-settings";

describe("toSiteContact", () => {
  it("maps stored settings to contact fields", () => {
    expect(toSiteContact({ "contact.email": "hello@example.com", "contact.phone": "+91 98765 43210", "company.legalName": "Example Pvt Ltd", "social.linkedin": "https://www.linkedin.com/company/x" }))
      .toEqual({ email: "hello@example.com", phone: "+91 98765 43210", legalName: "Example Pvt Ltd", linkedin: "https://www.linkedin.com/company/x" });
  });
  it("maps the careers email and drops a malformed one", () => {
    expect(toSiteContact({ "contact.careersEmail": "hr@example.com" })).toEqual({ careersEmail: "hr@example.com" });
    expect(toSiteContact({ "contact.careersEmail": "nope" })).toEqual({});
  });
  it("returns nothing when nothing is set (no hardcoded fallbacks)", () => { expect(toSiteContact({})).toEqual({}); });
  it("drops a malformed email and non-https social links", () => {
    expect(toSiteContact({ "contact.email": "not-an-email", "social.x": "javascript:alert(1)", "social.linkedin": "http://insecure.example" })).toEqual({});
  });
  it("never exposes notification recipients", () => {
    expect(JSON.stringify(toSiteContact({ "notifications.adminRecipients": "ops@example.com" }))).not.toContain("ops@");
  });
});
describe("telHref", () => { it("keeps digits and a leading plus only", () => { expect(telHref("+91 (98765) 43-210")).toBe("tel:+919876543210"); }); });
