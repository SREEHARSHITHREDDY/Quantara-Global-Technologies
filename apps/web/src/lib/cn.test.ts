import { describe, it, expect } from "vitest";
import { cn } from "./cn";
describe("cn", () => { it("merges and de-duplicates tailwind classes", () => { expect(cn("px-2", "px-4", false && "x")).toBe("px-4"); }); });
