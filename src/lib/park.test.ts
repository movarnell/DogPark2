import { describe, expect, it } from "vitest";
import { parkAmenityList, parkDisplayName, parkStableId } from "./park";

describe("park helpers", () => {
  it("uses the best available park display name", () => {
    expect(parkDisplayName({ id: "1", name: "Oak Run" })).toBe("Oak Run");
    expect(parkDisplayName({ id: "1", park_name: "Community Dog Park" })).toBe("Community Dog Park");
    expect(parkDisplayName({ id: "1" })).toBe("Unnamed dog park");
  });

  it("uses stable ids from Google, local park ids, ids, and names", () => {
    expect(parkStableId({ id: "1", googlePlaceId: "google-1", parkId: "park-1" })).toBe("google-1");
    expect(parkStableId({ id: "1", parkId: "park-1" })).toBe("park-1");
    expect(parkStableId({ id: 8, name: "Fallback Park" })).toBe("8");
    expect(parkStableId({ name: "Fallback Park" })).toBe("Fallback Park");
  });

  it("normalizes amenities from arrays, JSON strings, comma strings, and empty values", () => {
    expect(parkAmenityList({ id: "1", amenities: ["water", "shade"] })).toEqual(["water", "shade"]);
    expect(parkAmenityList({ id: "1", amenities: "[\"water\",\"shade\"]" })).toEqual(["water", "shade"]);
    expect(parkAmenityList({ id: "1", amenities: "water, shade, " })).toEqual(["water", "shade"]);
    expect(parkAmenityList({ id: "1" })).toEqual([]);
  });
});
