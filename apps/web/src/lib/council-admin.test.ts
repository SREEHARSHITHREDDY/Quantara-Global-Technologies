import { describe, expect, it } from "vitest";
import { validatePlanForm } from "./council-admin";

describe("validatePlanForm", () => {
  it("accepts each plan; a trial needs days", () => {
    expect(validatePlanForm({ plan: "STANDARD", maxConcurrent: "" })).toEqual({ ok: true, value: { plan: "STANDARD", maxConcurrent: null } });
    expect(validatePlanForm({ plan: "TRIAL", trialDays: "14", maxConcurrent: "3" })).toEqual({ ok: true, value: { plan: "TRIAL", trialDays: 14, maxConcurrent: 3 } });
    expect(validatePlanForm({ plan: "TRIAL", trialDays: "" })).toMatchObject({ ok: false, errors: { trialDays: expect.any(String) } });
  });
  it("rejects unknown plans and out-of-range or non-integer numbers", () => {
    expect(validatePlanForm({ plan: "FREE" })).toMatchObject({ ok: false, errors: { plan: expect.any(String) } });
    expect(validatePlanForm({ plan: "TRIAL", trialDays: "0" })).toMatchObject({ ok: false });
    expect(validatePlanForm({ plan: "TRIAL", trialDays: "91" })).toMatchObject({ ok: false });
    expect(validatePlanForm({ plan: "TRIAL", trialDays: "1.5" })).toMatchObject({ ok: false });
    expect(validatePlanForm({ plan: "STANDARD", maxConcurrent: "11" })).toMatchObject({ ok: false, errors: { maxConcurrent: expect.any(String) } });
    expect(validatePlanForm({ plan: "STANDARD", maxConcurrent: "abc" })).toMatchObject({ ok: false });
  });
  it("ignores trial days for non-trial plans", () => {
    expect(validatePlanForm({ plan: "ENTERPRISE", trialDays: "999" })).toEqual({ ok: true, value: { plan: "ENTERPRISE", maxConcurrent: null } });
  });
});
