import { describe, expect, it } from "vitest";
import { APPROVAL_CATEGORIES, classifyApproval } from "./approvals";

describe("classifyApproval", () => {
  it.each([
    ["Hire two regional sales managers", "HIRING_OR_TERMINATION"],
    ["Terminate the vendor's staff placement", "HIRING_OR_TERMINATION"],
    ["Sign the lease for the Dubai office", "CONTRACT_SIGNING"],
    ["Transfer AED 2M to the new entity", "FINANCIAL_TRANSFER"],
    ["Pay the licensing fee", "PAYMENT"],
    ["Submit the application to the regulator", "LEGALLY_BINDING_COMMUNICATION"],
    ["Deploy the new platform to production", "PRODUCTION_INFRASTRUCTURE_CHANGE"],
    ["Access confidential employee records", "RESTRICTED_RECORD_ACCESS"],
    ["Announce the plan to partners", "EXTERNAL_ACTION"],
  ] as const)("%s -> %s", (text, cat) => expect(classifyApproval(text)).toBe(cat));
  it("always returns a known category, even for empty or odd input", () => {
    for (const t of ["", "   ", "💥", "x".repeat(5000)]) expect(APPROVAL_CATEGORIES).toContain(classifyApproval(t));
  });
});
