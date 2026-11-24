import { describe, it, expect } from "vitest";
import { coordsFromMapUrl, mapOpenUrl } from "../../src/lib/geo";

describe("v3 §4 map links", () => {
  it("reads the usual Google Maps link shapes", () => {
    expect(coordsFromMapUrl("https://www.google.com/maps/place/X/@35.9306,36.6339,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d35.9311!4d36.6345")).toEqual({ lat: 35.9311, lng: 36.6345 });
    expect(coordsFromMapUrl("https://www.google.com/maps/@34.7324,36.7137,14z")).toEqual({ lat: 34.7324, lng: 36.7137 });
    expect(coordsFromMapUrl("https://maps.google.com/?q=33.5138,36.2765")).toEqual({ lat: 33.5138, lng: 36.2765 });
    expect(coordsFromMapUrl("35.93, 36.63")).toEqual({ lat: 35.93, lng: 36.63 });
  });
  it("rejects links without coordinates", () => {
    expect(coordsFromMapUrl("https://maps.app.goo.gl/abc123")).toBeNull();
    expect(coordsFromMapUrl("")).toBeNull();
  });
  it("E2E-15 target: opens directions at the coordinates", () => {
    expect(mapOpenUrl(35.93, 36.63)).toBe("https://www.google.com/maps/search/?api=1&query=35.93,36.63");
  });
});
