import { api } from "./api";
import { ParkType } from "../types/ParkType";

export type DogParkPhoto = {
  src: string;
  alt: string;
  credit: string;
  parkId?: string;
  parkName?: string;
  parkAddress?: string;
  parkTown?: string;
  distanceMiles?: number;
};

export const generalDogParkPhotos: DogParkPhoto[] = [
  {
    src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Dogs_playing_at_dog_park.JPG?width=1200",
    alt: "Dogs playing together at a public dog park",
    credit: "Dogs playing at dog park by Benpershouse on Wikimedia Commons",
  },
  {
    src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/USMC-06639.jpg?width=1200",
    alt: "A group of dogs socializing at Mira Mesa Dog Park",
    credit: "Mira Mesa Dog Park photo by United States Marine Corps on Wikimedia Commons",
  },
  {
    src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Floral_Dog_Park.jpg?width=1200",
    alt: "A fenced dog park in Opelika, Alabama",
    credit: "Floral Dog Park photo by Spellck on Wikimedia Commons",
  },
  {
    src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Dog_Park_4437.jpg?width=1200",
    alt: "Woodland Park Dog Park with open grass and park fencing",
    credit: "Woodland Park Dog Park photo by Chris Light on Wikimedia Commons",
  },
];

export function fallbackDogParkPhoto(seed: string | number = "") {
  const key = String(seed);
  const index = [...key].reduce((sum, character) => sum + character.charCodeAt(0), 0) % generalDogParkPhotos.length;
  return generalDogParkPhotos[index];
}

export function dogParkPhotosFromParks(parks: ParkType[]) {
  return parks
    .map((park) => {
      const src = api.assetUrl(park.photoUrl || park.image_URL);
      if (!src) return null;
      const photo: DogParkPhoto = {
        src,
        alt: `${park.name || park.park_name || "Local dog park"} photo`,
        credit: park.name || park.park_name || park.address || "Nearby dog park",
        parkId: park.googlePlaceId || park.parkId || (park.id ? String(park.id) : undefined),
        parkName: park.name || park.park_name || "Nearby dog park",
        parkAddress: park.address || park.location || "",
        parkTown: [park.city, park.state].filter(Boolean).join(", "),
        distanceMiles: park.distanceMiles,
      };
      return photo;
    })
    .filter((photo): photo is DogParkPhoto => Boolean(photo));
}
