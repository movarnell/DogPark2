import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { ParkType } from "../types/ParkType";
import ParkCard from "./ParkCard";

function Parks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeQuery = searchParams.get("q") || "";
  const activeLat = searchParams.get("lat") || "";
  const activeLng = searchParams.get("lng") || "";
  const activeRadius = searchParams.get("radius") || "";
  const [query, setQuery] = useState(activeQuery);
  const [parks, setParks] = useState<ParkType[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [useLocation, setUseLocation] = useState(false);

  useEffect(() => {
    setQuery(activeQuery);
  }, [activeQuery]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeLat && activeLng) {
      params.set("lat", activeLat);
      params.set("lng", activeLng);
      if (activeRadius) params.set("radius", activeRadius);
    } else if (activeQuery) {
      params.set("query", `${activeQuery} dog parks`);
    }
    params.set("limit", "18");
    setStatus("loading");
    setMessage("");
    api
      .searchParks(params)
      .then((data) => {
        setParks(data.results);
        setMessage(data.warning || "");
        setStatus("success");
      })
      .catch((error: Error) => {
        setMessage(error.message);
        setStatus("error");
      });
  }, [activeLat, activeLng, activeQuery, activeRadius]);

  const mapSrc = useMemo(() => {
    const firstPark = parks.find((park) => park.latitude && park.longitude);
    if (firstPark?.latitude && firstPark.longitude) {
      return `https://maps.google.com/maps?q=${firstPark.latitude},${firstPark.longitude}&z=12&output=embed`;
    }
    return `https://maps.google.com/maps?q=${encodeURIComponent(activeQuery || "dog parks in United States")}&output=embed`;
  }, [activeQuery, parks]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    setSearchParams(params);
  }

  function searchNearMe() {
    if (!navigator.geolocation) {
      setMessage("Location search is not available in this browser.");
      return;
    }
    setUseLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const params = new URLSearchParams();
        params.set("lat", String(position.coords.latitude));
        params.set("lng", String(position.coords.longitude));
        params.set("radius", "40000");
        setSearchParams(params);
        setUseLocation(false);
      },
      () => {
        setUseLocation(false);
        setMessage("Location permission was not granted.");
      },
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <section className="mb-6 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Find the next meetup spot</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Search parks, then post when you plan to go</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              Choose a park page to see upcoming visits from other owners, schedule your own trip, and help people time
              their visits for a more social dog park experience.
            </p>
          </div>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSearch}>
            <input
              className="min-h-11 min-w-0 rounded-md border border-stone-300 px-3 outline-none focus:border-emerald-800 sm:w-80"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="City, ZIP, or park name"
            />
            <button className="rounded-md bg-emerald-900 px-4 py-2 font-bold text-white" type="submit">
              Search
            </button>
            <button className="rounded-md border border-stone-300 px-4 py-2 font-bold text-stone-800" type="button" onClick={searchNearMe}>
              {useLocation ? "Locating..." : "Near me"}
            </button>
          </form>
        </div>
        {message && <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          {status === "loading" && <div className="rounded-lg border border-stone-200 bg-white p-5">Loading parks...</div>}
          {status === "error" && <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-900">Unable to load parks.</div>}
          {status === "success" && parks.length === 0 && (
            <div className="rounded-lg border border-stone-200 bg-white p-5">No parks found for this search.</div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {parks.map((park) => (
              <ParkCard key={park.googlePlaceId || park.parkId || park.id || park.name} park={park} />
            ))}
          </div>
        </div>
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
            <iframe className="h-[440px] w-full" src={mapSrc} title="Dog park search map" loading="lazy" />
            <div className="border-t border-stone-200 p-4 text-xs leading-5 text-stone-500">
              Open a park to coordinate a visit time, check who is going, and leave condition notes for nearby owners.
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default Parks;
