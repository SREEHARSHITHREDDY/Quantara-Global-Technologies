import { describe, expect, it } from "vitest";
import { councilDefaultFromEnv } from "./council-default-plan";

describe("councilDefaultFromEnv", () => {
  it("is open (STANDARD) when nothing is set", () => { expect(councilDefaultFromEnv({})).toEqual({ councilPlan: "STANDARD" }); });
  it("accepts STANDARD, DISABLED and TRIAL in any letter case", () => {
    expect(councilDefaultFromEnv({ COUNCIL_DEFAULT_PLAN: "standard" })).toEqual({ councilPlan: "STANDARD" });
    expect(councilDefaultFromEnv({ COUNCIL_DEFAULT_PLAN: " disabled " })).toEqual({ councilPlan: "DISABLED" });
    expect(councilDefaultFromEnv({ COUNCIL_DEFAULT_PLAN: "TRIAL" })).toEqual({ councilPlan: "TRIAL", councilTrialDays: 14 });
  });
  it("uses the configured trial length when it is sensible, otherwise 14 days", () => {
    expect(councilDefaultFromEnv({ COUNCIL_DEFAULT_PLAN: "TRIAL", COUNCIL_DEFAULT_TRIAL_DAYS: "30" }).councilTrialDays).toBe(30);
    for (const bad of ["0", "-3", "abc", "9999", ""]) expect(councilDefaultFromEnv({ COUNCIL_DEFAULT_PLAN: "TRIAL", COUNCIL_DEFAULT_TRIAL_DAYS: bad }).councilTrialDays).toBe(14);
  });
  it("closes access for anything unrecognised, including ENTERPRISE (never a default)", () => {
    for (const v of ["ENTERPRISE", "open", "yes", "STANDRD"]) expect(councilDefaultFromEnv({ COUNCIL_DEFAULT_PLAN: v })).toEqual({ councilPlan: "DISABLED" });
  });
});
