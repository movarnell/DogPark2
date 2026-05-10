import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Home() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    navigate(`/parks?${params.toString()}`);
  }

  return (
    <main>
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
          <div className="flex flex-col justify-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-wide text-emerald-800">Dog park meetups made simple</p>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-stone-950 md:text-6xl">
              Let other dog owners know when you are headed to the park.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-600">
              Dog Park Social helps neighbors turn solo dog park trips into shared playtime. Search local parks, post when
              you plan to go, see who else is headed there, and choose a time when your dog can actually meet friends.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-stone-700">
              <span className="rounded-full bg-emerald-50 px-4 py-2 text-emerald-900">Post your planned visit</span>
              <span className="rounded-full bg-sky-50 px-4 py-2 text-sky-900">Find overlapping schedules</span>
              <span className="rounded-full bg-amber-50 px-4 py-2 text-amber-900">Share park conditions</span>
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
                Search parks
              </button>
            </form>
          </div>
          <div className="grid content-end gap-4">
            <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
              <img
                className="h-64 w-full object-cover"
                src="https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?auto=format&fit=crop&w=1200&q=80"
                alt="Dogs playing together in a public park"
              />
              <div className="border-b border-stone-200 p-5">
                <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Tonight at Bentonville Bark Park</p>
                <div className="mt-4 space-y-3">
                  {[
                    ["5:30 PM", "Maya and Biscuit plan to go"],
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
          ["Tell people when you are going", "Pick a park and time so nearby owners can see when your dog will be there."],
          ["Choose a social time", "Check upcoming visits before you leave and show up when playmates are more likely to be there."],
          ["Keep the park useful", "Post reviews, current conditions, and corrections so everyone knows what to expect."],
        ].map(([title, body]) => (
          <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm" key={title}>
            <h2 className="text-lg font-black">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
          </article>
        ))}
      </section>
      <div className="mx-auto max-w-7xl px-4 pb-10">
        <Link className="font-bold text-emerald-900 underline underline-offset-4" to="/parks">
          Find a park and plan a visit
        </Link>
      </div>
    </main>
  );
}

export default Home;
