import { describe, expect, it } from "vitest";
import { Visit } from "./api";
import { getCompatibilitySummary, getVisitCompatibility, sortByCompatibility } from "./visitCompatibility";
import { DogType } from "../types/DogType";

const viewerDog: DogType = {
  id: "dog-1",
  ownerId: "owner-1",
  name: "Maple",
  dog_name: "Maple",
  breed: "Retriever mix",
  size: "medium",
  isFriendly: true,
  isPuppy: false,
  isPublic: true,
};

function visit(overrides: Partial<Visit>): Visit {
  return {
    id: "visit-1",
    park_ref: "park-1",
    starts_at: "2099-05-08T15:00:00.000Z",
    duration_minutes: 60,
    status: "planned",
    ...overrides,
  };
}

describe("visit compatibility helpers", () => {
  it("uses server-computed compatibility before local breed and size fallback", () => {
    const compatibility = getVisitCompatibility(
      visit({
        dog_breed: "Different",
        dog_size: "large",
        compatibility: {
          score: 72,
          tier: "best",
          reasons: ["Same breed: Retriever mix", "Same size: medium"],
          cautions: ["Needs a calm intro"],
        },
      }),
      viewerDog,
    );

    expect(compatibility).toMatchObject({
      sameBreed: true,
      sameSize: true,
      score: 72,
      tier: "best",
    });
    expect(compatibility.cautions).toEqual(["Needs a calm intro"]);
  });

  it("falls back to same breed and same size scoring when the API has not scored a visit", () => {
    const compatibility = getVisitCompatibility(
      visit({ dog_breed: "Retriever mix", dog_size: "medium" }),
      viewerDog,
    );

    expect(compatibility.score).toBe(44);
    expect(compatibility.labels).toEqual(["Same breed: Retriever mix", "Same size: medium"]);
  });

  it("summarizes and sorts compatible visits first without mutating the original list", () => {
    const visits = [
      visit({ id: "late", starts_at: "2099-05-08T18:00:00.000Z", dog_breed: "Poodle", dog_size: "small" }),
      visit({ id: "best", starts_at: "2099-05-08T17:00:00.000Z", dog_breed: "Retriever mix", dog_size: "medium" }),
      visit({ id: "size", starts_at: "2099-05-08T16:00:00.000Z", dog_breed: "Poodle", dog_size: "medium" }),
    ];

    expect(getCompatibilitySummary(visits, viewerDog)).toMatchObject({
      sameBreedCount: 1,
      sameSizeCount: 2,
      compatibleVisitCount: 2,
      bestMatch: expect.objectContaining({ id: "best" }),
    });
    expect(sortByCompatibility(visits, viewerDog).map((item) => item.id)).toEqual(["best", "size", "late"]);
    expect(visits.map((item) => item.id)).toEqual(["late", "best", "size"]);
  });
});
