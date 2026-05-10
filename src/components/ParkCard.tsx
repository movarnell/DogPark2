import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { fallbackDogParkPhoto } from "../lib/dogParkPhotos";
import { parkAmenityList, parkDisplayName, parkStableId } from "../lib/park";
import { ParkType } from "../types/ParkType";

function ParkCard({ park }: { park: ParkType }) {
  const amenities = parkAmenityList(park).slice(0, 5);
  const parkId = parkStableId(park);
  const imageUrl = api.assetUrl(park.photoUrl || park.image_URL);
  const fallbackPhoto = fallbackDogParkPhoto(parkId || parkDisplayName(park));

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
      {imageUrl ? (
        <img className="h-44 w-full object-cover" src={imageUrl} alt={parkDisplayName(park)} />
      ) : (
        <img className="h-44 w-full object-cover" src={fallbackPhoto.src} alt={fallbackPhoto.alt} />
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-black leading-tight">{parkDisplayName(park)}</h2>
          {park.rating && (
            <span className="rounded-md bg-amber-100 px-2 py-1 text-sm font-bold text-amber-900">
              {park.rating.toFixed(1)}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm leading-6 text-stone-600">{park.address || park.location}</p>
        {typeof park.distanceMiles === "number" && (
          <p className="mt-2 text-xs font-black uppercase tracking-wide text-emerald-800">
            {park.distanceMiles.toFixed(park.distanceMiles < 10 ? 1 : 0)} miles away
          </p>
        )}
        <div className="mt-4 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-950">
          Open this park to see planned visits and let others know when you are going.
        </div>
        {amenities.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {amenities.map((amenity) => (
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700" key={amenity}>
                {amenity}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-5">
          <span className="text-xs font-bold uppercase tracking-wide text-stone-500">
            {park.source === "google" ? "Google Places" : "Community"}
          </span>
          <Link className="rounded-md bg-emerald-900 px-3 py-2 text-sm font-bold text-white" to={`/parks/${encodeURIComponent(parkId)}`}>
            Plan visit
          </Link>
        </div>
      </div>
    </article>
  );
}

export default ParkCard;
