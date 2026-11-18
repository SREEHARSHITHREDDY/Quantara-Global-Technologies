import { describe, expect, it } from "vitest";
import { checkJsonPost, checkOrigin } from "./same-origin";

const req = (h: Record<string, string>) => new Request("http://localhost:3000/api/x", { method: "POST", headers: h });
const SITE = "http://localhost:3000";
describe("same-origin guard", () => {
  it("accepts a same-origin JSON post", () => { expect(checkJsonPost(req({ origin: SITE, "content-type": "application/json" }), SITE)).toEqual({ ok: true }); });
  it("refuses another origin, a missing origin, and a null origin", () => {
    for (const origin of ["https://evil.example", "null", ""]) {
      const h: Record<string, string> = { "content-type": "application/json" }; if (origin) h.origin = origin;
      expect(checkJsonPost(req(h), SITE)).toMatchObject({ ok: false, status: 403 });
    }
  });
  it("refuses non-JSON bodies, which is what a cross-site form can send", () => {
    expect(checkJsonPost(req({ origin: SITE, "content-type": "text/plain" }), SITE)).toMatchObject({ ok: false, status: 415 });
    expect(checkJsonPost(req({ origin: SITE, "content-type": "application/x-www-form-urlencoded" }), SITE)).toMatchObject({ ok: false, status: 415 });
  });
  it("does not match on a prefix of the host", () => {
    expect(checkOrigin(req({ origin: "http://localhost:3000.evil.example" }), SITE)).toMatchObject({ ok: false });
  });
  it("fails closed when the site origin is misconfigured", () => { expect(checkOrigin(req({ origin: SITE }), "")).toMatchObject({ ok: false, status: 500 }); });
});
