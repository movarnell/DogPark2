import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import { DogType } from "../types/DogType";
import { HumanType } from "../types/HumanType";

function ManageDogs({ signedInUser }: { signedInUser: HumanType | null }) {
  const [dogs, setDogs] = useState<DogType[]>([]);
  const [dogName, setDogName] = useState("");
  const [breed, setBreed] = useState("");
  const [isFriendly, setIsFriendly] = useState(true);
  const [isPuppy, setIsPuppy] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [dogSize, setDogSize] = useState("medium");
  const [message, setMessage] = useState("");

  async function fetchDogs() {
    try {
      const data = await api.getDogs();
      setDogs(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to fetch dogs");
    }
  }

  useEffect(() => {
    fetchDogs();
  }, []);

  async function handleAddDog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      const newDog = await api.createDog({
        name: dogName,
        dog_name: dogName,
        breed,
        isFriendly,
        isPuppy,
        isPublic,
        size: dogSize,
      });
      setDogs([newDog, ...dogs]);
      setDogName("");
      setBreed("");
      setIsFriendly(true);
      setIsPuppy(false);
      setIsPublic(true);
      setDogSize("medium");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add dog");
    }
  }

  async function handleRemoveDog(id: string) {
    await api.deleteDog(id);
    setDogs(dogs.filter((dog) => dog.id !== id));
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Account</p>
        <h1 className="mt-1 text-3xl font-black">Manage dogs</h1>
        <p className="mt-2 text-stone-600">Signed in as {signedInUser?.username}</p>
        {message && <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        <form onSubmit={handleAddDog} className="h-fit rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Add dog</h2>
          <input className="mt-4 w-full rounded-md border border-stone-300 px-3 py-2" value={dogName} onChange={(event) => setDogName(event.target.value)} placeholder="Dog name" required />
          <input className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2" value={breed} onChange={(event) => setBreed(event.target.value)} placeholder="Breed or mix" />
          <select className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2" value={dogSize} onChange={(event) => setDogSize(event.target.value)}>
            <option value="small">Small (0-20 lbs)</option>
            <option value="medium">Medium (20-40 lbs)</option>
            <option value="large">Large (40-90 lbs)</option>
            <option value="giant">Giant (90+ lbs)</option>
          </select>
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={isFriendly} onChange={(event) => setIsFriendly(event.target.checked)} />
            Friendly with other dogs
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={isPuppy} onChange={(event) => setIsPuppy(event.target.checked)} />
            Puppy
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
            Show on public visit cards
          </label>
          <button type="submit" className="mt-5 w-full rounded-md bg-emerald-900 px-4 py-2 font-bold text-white">
            Add dog
          </button>
        </form>
        <div className="grid gap-4 md:grid-cols-2">
          {dogs.map((dog) => (
            <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm" key={dog.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">{dog.name || dog.dog_name}</h2>
                  <p className="mt-1 text-sm text-stone-600">{[dog.breed, dog.size].filter(Boolean).join(" · ")}</p>
                </div>
                <button className="rounded-md border border-red-200 px-3 py-1 text-sm font-bold text-red-700" onClick={() => handleRemoveDog(dog.id)}>
                  Remove
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold">{dog.isFriendly ? "Friendly" : "Needs space"}</span>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold">{dog.isPuppy ? "Puppy" : "Adult"}</span>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold">{dog.isPublic ? "Public" : "Private"}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default ManageDogs;
