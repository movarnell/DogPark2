import { ParkType } from "../types/ParkType";

export function parkDisplayName(park: ParkType): string {
  return park.name || park.park_name || "Unnamed dog park";
}

export function parkStableId(park: ParkType): string {
  return park.googlePlaceId || park.parkId || String(park.id || parkDisplayName(park));
}

export function parkAmenityList(park: ParkType): string[] {
  if (Array.isArray(park.amenities)) return park.amenities;
  if (!park.amenities) return [];
  try {
    const parsed = JSON.parse(park.amenities);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return park.amenities
      .split(",")
      .map((amenity) => amenity.trim())
      .filter(Boolean);
  }
}
