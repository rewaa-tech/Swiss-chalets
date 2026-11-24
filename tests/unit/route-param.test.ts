import { describe, it, expect } from "vitest";
import { routeParam } from "../../src/lib/paths";

describe("T-22 routeParam", () => {
  it("decodes percent-encoded Arabic slugs", () => {
    expect(routeParam(encodeURIComponent("كوخ-الصنوبر"))).toBe("كوخ-الصنوبر");
  });
  it("keeps already-decoded and ascii values", () => {
    expect(routeParam("كوخ-الصنوبر")).toBe("كوخ-الصنوبر");
    expect(routeParam("test-hut")).toBe("test-hut");
  });
  it("never throws on malformed input", () => {
    expect(routeParam("%E0%A4%A")).toBe("%E0%A4%A");
    expect(routeParam(undefined)).toBe("");
  });
});
