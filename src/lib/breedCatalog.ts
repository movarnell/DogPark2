export const DOG_BREEDS = [
  "Australian Shepherd",
  "Beagle",
  "Bernese Mountain Dog",
  "Bichon Frise",
  "Border Collie",
  "Boston Terrier",
  "Boxer",
  "Bulldog",
  "Cane Corso",
  "Cavalier King Charles Spaniel",
  "Chihuahua",
  "Cocker Spaniel",
  "Corgi",
  "Dachshund",
  "Dalmatian",
  "Doberman Pinscher",
  "French Bulldog",
  "German Shepherd",
  "Golden Retriever",
  "Goldendoodle",
  "Great Dane",
  "Great Pyrenees",
  "Havanese",
  "Husky",
  "Labradoodle",
  "Labrador Retriever",
  "Maltese",
  "Miniature Schnauzer",
  "Mixed Breed",
  "Pit Bull Terrier",
  "Pomeranian",
  "Poodle",
  "Pug",
  "Rottweiler",
  "Shiba Inu",
  "Shih Tzu",
  "Yorkshire Terrier",
];

const BREED_ALIASES = new Map<string, string>([
  ["aussie", "Australian Shepherd"],
  ["border collie mix", "Border Collie"],
  ["bully", "Pit Bull Terrier"],
  ["corgi mix", "Corgi"],
  ["doodle", "Goldendoodle"],
  ["frenchie", "French Bulldog"],
  ["german shepard", "German Shepherd"],
  ["golden", "Golden Retriever"],
  ["golden mix", "Golden Retriever"],
  ["great pyr", "Great Pyrenees"],
  ["lab", "Labrador Retriever"],
  ["lab mix", "Labrador Retriever"],
  ["labrador", "Labrador Retriever"],
  ["mutt", "Mixed Breed"],
  ["pittie", "Pit Bull Terrier"],
  ["pitbull", "Pit Bull Terrier"],
  ["pom", "Pomeranian"],
  ["retriever mix", "Golden Retriever"],
  ["shepherd", "German Shepherd"],
  ["yorkie", "Yorkshire Terrier"],
]);

function cleanBreed(value?: string) {
  return (value || "").trim().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, " ");
}

function breedKey(value?: string) {
  return cleanBreed(value).toLowerCase().replace(/\s+/g, "-");
}

export function canonicalBreed(value?: string) {
  const cleaned = cleanBreed(value);
  if (!cleaned) return "";
  const lowered = cleaned.toLowerCase();
  const withoutMix = lowered.replace(/\b(mix|mixed)\b/g, "").replace(/\s+/g, " ").trim();
  return BREED_ALIASES.get(lowered)
    || BREED_ALIASES.get(withoutMix)
    || DOG_BREEDS.find((breed) => breed.toLowerCase() === lowered || breed.toLowerCase() === withoutMix)
    || cleaned;
}

export function canonicalBreedKey(value?: string) {
  return breedKey(canonicalBreed(value));
}
