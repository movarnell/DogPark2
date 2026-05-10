import { Visit } from "./api";
import { canonicalBreedKey } from "./breedCatalog";
import { DogType } from "../types/DogType";

function normalizeDogTrait(value?: string) {
  return (value || "").trim().toLowerCase();
}

export function getVisitCompatibility(visit: Visit, dog?: DogType) {
  if (visit.compatibility) {
    return {
      sameBreed: visit.compatibility.reasons.some((reason) => reason.toLowerCase().includes("same breed")),
      sameSize: visit.compatibility.reasons.some((reason) => reason.toLowerCase().includes("same size")),
      score: visit.compatibility.score,
      tier: visit.compatibility.tier,
      labels: visit.compatibility.reasons,
      cautions: visit.compatibility.cautions,
    };
  }

  const selectedBreed = normalizeDogTrait(dog?.breedKey) || canonicalBreedKey(dog?.breed);
  const selectedSize = normalizeDogTrait(dog?.size);
  const visitBreed = normalizeDogTrait(visit.dog_breed_key) || canonicalBreedKey(visit.dog_breed);
  const visitSize = normalizeDogTrait(visit.dog_size);
  const sameBreed = Boolean(selectedBreed && visitBreed && selectedBreed === visitBreed);
  const sameSize = Boolean(selectedSize && visitSize && selectedSize === visitSize);

  return {
    sameBreed,
    sameSize,
    score: (sameBreed ? 24 : 0) + (sameSize ? 20 : 0),
    tier: sameBreed || sameSize ? "good" : "open",
    labels: [
      sameBreed ? `Same breed: ${visit.dog_breed}` : "",
      sameSize ? `Same size: ${visit.dog_size}` : "",
    ].filter(Boolean),
    cautions: [] as string[],
  };
}

export function getCompatibilitySummary(visits: Visit[], dog?: DogType) {
  if (!dog) {
    return {
      sameBreedCount: 0,
      sameSizeCount: 0,
      compatibleVisitCount: 0,
      bestMatch: null as Visit | null,
      bestMatchCompatibility: { sameBreed: false, sameSize: false, score: 0, tier: "open", labels: [] as string[], cautions: [] as string[] },
    };
  }

  return visits.reduce(
    (summary, visit) => {
      const compatibility = getVisitCompatibility(visit, dog);
      const isBetterMatch =
        compatibility.score > summary.bestMatchCompatibility.score ||
        (compatibility.score === summary.bestMatchCompatibility.score && compatibility.tier === "best" && summary.bestMatchCompatibility.tier !== "best");

      return {
        sameBreedCount: summary.sameBreedCount + (compatibility.sameBreed ? 1 : 0),
        sameSizeCount: summary.sameSizeCount + (compatibility.sameSize ? 1 : 0),
        compatibleVisitCount: summary.compatibleVisitCount + (compatibility.score > 0 ? 1 : 0),
        bestMatch: isBetterMatch ? visit : summary.bestMatch,
        bestMatchCompatibility: isBetterMatch ? compatibility : summary.bestMatchCompatibility,
      };
    },
    {
      sameBreedCount: 0,
      sameSizeCount: 0,
      compatibleVisitCount: 0,
      bestMatch: null as Visit | null,
      bestMatchCompatibility: { sameBreed: false, sameSize: false, score: 0, tier: "open", labels: [] as string[], cautions: [] as string[] },
    },
  );
}

export function sortByCompatibility(visits: Visit[], dog?: DogType) {
  if (!dog) return visits;
  return [...visits].sort((first, second) => {
    const firstCompatibility = getVisitCompatibility(first, dog);
    const secondCompatibility = getVisitCompatibility(second, dog);
    if (secondCompatibility.score !== firstCompatibility.score) {
      return secondCompatibility.score - firstCompatibility.score;
    }
    return String(first.starts_at).localeCompare(String(second.starts_at));
  });
}
