import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { dogParkPhotosFromParks, generalDogParkPhotos } from "../lib/dogParkPhotos";

const randomDogParkLocations = [
  "Austin, TX",
  "Bentonville, AR",
  "Denver, CO",
  "Madison, WI",
  "Portland, OR",
  "Raleigh, NC",
  "San Diego, CA",
  "Seattle, WA",
];

function Home() {
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState(generalDogParkPhotos);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoScope, setPhotoScope] = useState<"general" | "local">("general");
  const [photoMessage, setPhotoMessage] = useState("");
  const navigate = useNavigate();
  const activePhoto = photos[photoIndex % photos.length] || generalDogParkPhotos[0];
  const activeParkTarget = activePhoto.parkId
    ? `/parks/${encodeURIComponent(activePhoto.parkId)}`
    : `/parks?q=${encodeURIComponent(activePhoto.parkName || activePhoto.parkTown || "dog parks")}`;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    navigate(`/parks?${params.toString()}`);
  }

  const loadLocalDogParkPhotos = useCallback(async (position: GeolocationPosition) => {
    const params = new URLSearchParams();
    params.set("lat", String(position.coords.latitude));
    params.set("lng", String(position.coords.longitude));
    params.set("radius", "80467");
    params.set("limit", "12");
    const data = await api.searchParks(params);
    const localPhotos = dogParkPhotosFromParks(data.results);
    if (localPhotos.length > 0) {
      setPhotos(localPhotos);
      setPhotoIndex(0);
      setPhotoScope("local");
      setPhotoMessage(
        data.searchArea
          ? `Showing photos from dog parks within ${data.searchArea.radiusMiles.toFixed(0)} miles of you.`
          : "Showing photos from dog parks near you.",
      );
      return;
    }
    setPhotoMessage("Nearby dog parks loaded, but they did not include photos yet.");
  }, []);

  const loadRandomDogParkPhotos = useCallback(async () => {
    const location = randomDogParkLocations[Math.floor(Math.random() * randomDogParkLocations.length)];
    const params = new URLSearchParams();
    params.set("query", "dog parks");
    params.set("location", location);
    params.set("limit", "12");
    const data = await Promise.race([
      api.searchParks(params),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("Random dog park lookup timed out")), 2500);
      }),
    ]);
    const randomPhotos = dogParkPhotosFromParks(data.results);
    if (randomPhotos.length > 0) {
      setPhotos(randomPhotos);
      setPhotoIndex(0);
      setPhotoScope("general");
      setPhotoMessage(`Showing dog parks around ${location}.`);
      return;
    }
    setPhotos(generalDogParkPhotos);
    setPhotoScope("general");
    setPhotoMessage("Showing dog parks from around the US.");
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhotoIndex((current) => (current + 1) % photos.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [photos.length]);

  useEffect(() => {
    if (!navigator.geolocation || !navigator.permissions?.query) {
      loadRandomDogParkPhotos().catch(() => undefined);
      return;
    }
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((permission) => {
        if (permission.state !== "granted") {
          loadRandomDogParkPhotos().catch(() => undefined);
          return;
        }
        navigator.geolocation.getCurrentPosition((position) => {
          loadLocalDogParkPhotos(position).catch(() => {
            loadRandomDogParkPhotos().catch(() => undefined);
          });
        });
      })
      .catch(() => {
        loadRandomDogParkPhotos().catch(() => undefined);
      });
  }, [loadLocalDogParkPhotos, loadRandomDogParkPhotos]);

  const photoDots = useMemo(() => photos.map((photo, index) => ({ label: photo.credit, index })), [photos]);

  return (
    <main>
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
          <div className="flex flex-col justify-center">
            <div className="mb-6 flex items-center gap-3">
              <img className="h-14 w-14 rounded-xl" src="/brand/dog-park-meetup-mark.svg" alt="" />
              <span className="text-lg font-black text-emerald-950">Dog Park Meetup</span>
            </div>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-stone-950 md:text-6xl">Dog Park Meetup</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-600">
              Make the dog park feel like a community. Post when you are going, see who else is headed there, and meet
              the local dogs and owners who already share your favorite parks.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-stone-700">
              <span className="rounded-md bg-emerald-50 px-4 py-2 text-emerald-900">Plan visits</span>
              <span className="rounded-md bg-sky-50 px-4 py-2 text-sky-900">Find your local pack</span>
              <span className="rounded-md bg-amber-50 px-4 py-2 text-amber-900">Share park conditions</span>
            </div>
            <form className="mt-8 flex max-w-2xl flex-col gap-3 rounded-lg border border-stone-200 bg-stone-50 p-2 shadow-sm sm:flex-row" onSubmit={handleSearch}>
              <label className="sr-only" htmlFor="park-search">
                City, state, ZIP, or park name
              </label>
              <input
                id="park-search"
                className="min-h-12 flex-1 rounded-md border border-stone-200 bg-white px-4 text-base outline-none focus:border-emerald-800"
                placeholder="Search Austin, Denver, Seattle..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button className="min-h-12 rounded-md bg-emerald-900 px-5 font-bold text-white" type="submit">
                Find your park
              </button>
            </form>
          </div>
          <div className="grid content-end gap-4">
            <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
              <img
                className="h-72 w-full object-cover transition-opacity"
                src={activePhoto.src}
                alt={activePhoto.alt}
              />
              <div className="flex flex-col gap-3 border-b border-stone-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-wide text-emerald-800">
                    {photoScope === "local" ? "Local dog park photos" : "Dog parks around the US"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-stone-500">{activePhoto.credit}</p>
                  {activePhoto.parkName && (
                    <div className="mt-2 text-xs leading-5 text-stone-600">
                      <p className="font-black text-stone-800">{activePhoto.parkName}</p>
                      <p>{activePhoto.parkAddress || activePhoto.parkTown}</p>
                      {typeof activePhoto.distanceMiles === "number" && (
                        <p className="font-bold text-emerald-800">
                          {activePhoto.distanceMiles.toFixed(activePhoto.distanceMiles < 10 ? 1 : 0)} miles away
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1" aria-label="Dog park photo rotation">
                    {photoDots.map((dot) => (
                      <button
                        className={`h-2.5 w-2.5 rounded-full ${dot.index === photoIndex % photos.length ? "bg-emerald-900" : "bg-stone-300"}`}
                        key={`${dot.label}-${dot.index}`}
                        type="button"
                        aria-label={`Show photo ${dot.index + 1}`}
                        onClick={() => setPhotoIndex(dot.index)}
                      />
                    ))}
                  </div>
                  <Link
                    className="whitespace-nowrap rounded-md border border-stone-300 px-3 py-2 text-xs font-black text-stone-800 hover:bg-stone-50"
                    to={activeParkTarget}
                  >
                    See This Park
                  </Link>
                </div>
              </div>
              {photoMessage && <p className="border-b border-stone-200 bg-emerald-50 px-5 py-2 text-xs font-semibold text-emerald-950">{photoMessage}</p>}
              <div className="border-b border-stone-200 p-5">
                <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Tonight at Bentonville Bark Park</p>
                <div className="mt-4 space-y-3">
                  {[
                    ["5:30 PM", "Maya and Biscuit are starting the after-work meetup"],
                    ["6:00 PM", "Jordan and Pepper are looking for small-dog playmates"],
                    ["6:30 PM", "Avery checked in: water station is working"],
                  ].map(([time, activity]) => (
                    <div className="flex gap-3 rounded-md bg-stone-50 p-3" key={time}>
                      <span className="min-w-16 text-sm font-black text-stone-950">{time}</span>
                      <span className="text-sm leading-5 text-stone-600">{activity}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-stone-200">
                <div className="p-4">
                  <p className="text-2xl font-black">Plan</p>
                  <p className="text-xs font-semibold uppercase text-stone-500">Before you go</p>
                </div>
                <div className="p-4">
                  <p className="text-2xl font-black">Meet</p>
                  <p className="text-xs font-semibold uppercase text-stone-500">Other owners</p>
                </div>
                <div className="p-4">
                  <p className="text-2xl font-black">Share</p>
                  <p className="text-xs font-semibold uppercase text-stone-500">Live notes</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-8 md:grid-cols-3">
        {[
          ["Know who is going", "Pick a park and time so nearby owners can see when your dog will be there."],
          ["Make familiar play windows", "Check upcoming visits and show up when playmates are more likely to be there."],
          ["Keep the park useful", "Post current conditions, corrections, and community notes so everyone knows what to expect."],
        ].map(([title, body]) => (
          <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm" key={title}>
            <h2 className="text-lg font-black">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
          </article>
        ))}
      </section>
      <div className="mx-auto max-w-7xl px-4 pb-10">
        <Link className="font-bold text-emerald-900 underline underline-offset-4" to="/parks">
          Find your park and plan a meetup
        </Link>
      </div>
    </main>
  );
}

export default Home;
