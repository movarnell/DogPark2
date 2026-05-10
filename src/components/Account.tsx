import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, FriendsResponse, UserBrief, Visit } from "../lib/api";
import { parkDisplayName } from "../lib/park";
import { DogType } from "../types/DogType";
import { HumanType } from "../types/HumanType";

type DogDraft = {
  name: string;
  breed: string;
  size: string;
  avatarUrl: string;
  notes: string;
  isFriendly: boolean;
  isPuppy: boolean;
  isPublic: boolean;
};

type VisitDraft = {
  dogId: string;
  startsAt: string;
  durationMinutes: number;
  notes: string;
  socialIntent: string;
};

function emptyFriends(): FriendsResponse {
  return { friends: [], incomingRequests: [], outgoingRequests: [] };
}

function userLabel(user: UserBrief) {
  return user.fullName || user.username || "Owner";
}

function toDatetimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function dogDraftFromDog(dog: DogType): DogDraft {
  return {
    name: dog.name || dog.dog_name || "",
    breed: dog.breed || "",
    size: dog.size || "medium",
    avatarUrl: dog.avatarUrl || "",
    notes: dog.notes || "",
    isFriendly: dog.isFriendly,
    isPuppy: dog.isPuppy,
    isPublic: dog.isPublic ?? true,
  };
}

function visitDraftFromVisit(visit: Visit): VisitDraft {
  return {
    dogId: visit.dog_id || "",
    startsAt: toDatetimeLocal(visit.starts_at),
    durationMinutes: visit.duration_minutes || 60,
    notes: visit.notes || "",
    socialIntent: visit.social_intent || "",
  };
}

function ProfilePhotoPreview({ src, label, size = "h-14 w-14" }: { src?: string; label: string; size?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-900 text-sm font-black text-white ${size}`}>
      {src && !failed ? (
        <img className="h-full w-full object-cover" src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        label.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

function Account({
  signedInUser,
  setSignedInUser,
}: {
  signedInUser: HumanType | null;
  setSignedInUser: (user: HumanType | null) => void;
}) {
  const [fullName, setFullName] = useState(signedInUser?.fullName || signedInUser?.human_name || "");
  const [username, setUsername] = useState(signedInUser?.username || "");
  const [bio, setBio] = useState(signedInUser?.bio || "");
  const [homeCity, setHomeCity] = useState(signedInUser?.homeCity || "");
  const [avatarUrl, setAvatarUrl] = useState(signedInUser?.avatarUrl || "");
  const [messagesEnabled, setMessagesEnabled] = useState(signedInUser?.messagesEnabled ?? true);
  const [activityVisibility, setActivityVisibility] = useState<HumanType["activityVisibility"]>(signedInUser?.activityVisibility || "owner_and_dog");
  const [dogs, setDogs] = useState<DogType[]>([]);
  const [dogDrafts, setDogDrafts] = useState<Record<string, DogDraft>>({});
  const [newDog, setNewDog] = useState<DogDraft>({
    name: "",
    breed: "",
    size: "medium",
    avatarUrl: "",
    notes: "",
    isFriendly: true,
    isPuppy: false,
    isPublic: true,
  });
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitDrafts, setVisitDrafts] = useState<Record<string, VisitDraft>>({});
  const [visitParkNames, setVisitParkNames] = useState<Record<string, string>>({});
  const [friends, setFriends] = useState<FriendsResponse>(emptyFriends);
  const [blockedUsers, setBlockedUsers] = useState<UserBrief[]>([]);
  const [message, setMessage] = useState("");

  async function refreshAccountData() {
    try {
      const [dogData, visitData, friendData, blockData] = await Promise.all([
        api.getDogs(),
        api.getMyVisits(),
        api.getFriends(),
        api.getBlocks(),
      ]);
      const uniqueParkRefs = [...new Set(visitData.map((visit) => visit.park_ref).filter(Boolean))];
      const parkNameEntries = await Promise.all(
        uniqueParkRefs.map(async (parkRef) => {
          try {
            const park = await api.getPark(parkRef);
            return [parkRef, parkDisplayName(park)] as const;
          } catch {
            return [parkRef, parkRef] as const;
          }
        }),
      );
      setDogs(dogData);
      setDogDrafts(
        dogData.reduce<Record<string, DogDraft>>((drafts, dog) => {
          drafts[dog.id] = dogDraftFromDog(dog);
          return drafts;
        }, {}),
      );
      setVisits(visitData);
      setVisitParkNames(Object.fromEntries(parkNameEntries));
      setFriends(friendData);
      setBlockedUsers(blockData);
      setVisitDrafts(
        visitData.reduce<Record<string, VisitDraft>>((drafts, visit) => {
          drafts[visit.id] = visitDraftFromVisit(visit);
          return drafts;
        }, {}),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load account data.");
    }
  }

  useEffect(() => {
    refreshAccountData();
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      const user = await api.updateMe({ fullName, username, bio, homeCity, avatarUrl, messagesEnabled, activityVisibility });
      setSignedInUser(user);
      setMessage("Profile updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update profile.");
    }
  }

  async function addDog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      const dog = await api.createDog({ ...newDog, dog_name: newDog.name });
      setDogs((current) => [dog, ...current]);
      setDogDrafts((current) => ({ ...current, [dog.id]: dogDraftFromDog(dog) }));
      setNewDog({ name: "", breed: "", size: "medium", avatarUrl: "", notes: "", isFriendly: true, isPuppy: false, isPublic: true });
      setMessage("Dog added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add dog.");
    }
  }

  async function saveDog(dogId: string) {
    const draft = dogDrafts[dogId];
    if (!draft) return;
    setMessage("");
    try {
      const dog = await api.updateDog(dogId, { ...draft, dog_name: draft.name });
      setDogs((current) => current.map((item) => (item.id === dogId ? dog : item)));
      setDogDrafts((current) => ({ ...current, [dogId]: dogDraftFromDog(dog) }));
      setMessage("Dog updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update dog.");
    }
  }

  async function removeDog(dogId: string) {
    setMessage("");
    try {
      await api.deleteDog(dogId);
      setDogs((current) => current.filter((dog) => dog.id !== dogId));
      setMessage("Dog removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove dog.");
    }
  }

  async function saveVisit(visitId: string) {
    const draft = visitDrafts[visitId];
    if (!draft) return;
    setMessage("");
    try {
      await api.updateVisit(visitId, draft);
      await refreshAccountData();
      setMessage("Visit updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update visit.");
    }
  }

  async function cancelVisit(visitId: string) {
    setMessage("");
    try {
      await api.updateVisit(visitId, { status: "cancelled" });
      setVisits((current) => current.filter((visit) => visit.id !== visitId));
      setMessage("Visit cancelled.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not cancel visit.");
    }
  }

  async function checkIn(visitId: string) {
    setMessage("");
    try {
      await api.checkIn(visitId);
      await refreshAccountData();
      setMessage("Checked in.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not check in.");
    }
  }

  async function respondToFriendRequest(id: string, accepted: boolean) {
    setMessage("");
    try {
      if (accepted) {
        await api.acceptFriendRequest(id);
        setMessage("Friend request accepted.");
      } else {
        await api.declineFriendRequest(id);
        setMessage("Friend request declined.");
      }
      await refreshAccountData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update friend request.");
    }
  }

  async function removeFriend(userId: string | number) {
    setMessage("");
    try {
      await api.removeFriend(userId);
      await refreshAccountData();
      setMessage("Friend removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove friend.");
    }
  }

  async function unblockUser(userId: string | number) {
    setMessage("");
    try {
      await api.unblockUser(userId);
      await refreshAccountData();
      setMessage("User unblocked.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not unblock user.");
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Account</p>
        <h1 className="mt-1 text-3xl font-black">Profile, dogs, and visits</h1>
        <p className="mt-2 text-stone-600">Keep your owner profile current and manage the dogs and park plans tied to it.</p>
        {message && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{message}</p>}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <form className="h-fit rounded-lg border border-stone-200 bg-white p-5 shadow-sm" onSubmit={saveProfile}>
          <h2 className="text-xl font-black">Profile</h2>
          <div className="mt-4 flex items-center gap-3 rounded-md bg-stone-50 p-3">
            <ProfilePhotoPreview src={avatarUrl} label={fullName || username || "U"} />
            <div className="min-w-0">
              <p className="font-bold text-stone-950">{fullName || username || "Profile photo"}</p>
              <p className="text-xs leading-5 text-stone-500">Shown in the navigation and on community activity.</p>
            </div>
          </div>
          <label className="mt-4 block text-sm font-bold text-stone-700">
            Profile photo URL
            <input className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://..." />
          </label>
          <label className="mt-4 block text-sm font-bold text-stone-700">
            Display name
            <input className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
          <label className="mt-3 block text-sm font-bold text-stone-700">
            Username
            <input className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="mt-3 block text-sm font-bold text-stone-700">
            Home city
            <input className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" value={homeCity} onChange={(event) => setHomeCity(event.target.value)} placeholder="Rogers, AR" />
          </label>
          <label className="mt-3 block text-sm font-bold text-stone-700">
            Bio
            <textarea className="mt-1 min-h-24 w-full rounded-md border border-stone-300 px-3 py-2" value={bio} onChange={(event) => setBio(event.target.value)} />
          </label>
          <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3">
            <h3 className="font-black text-stone-950">Privacy</h3>
            <label className="mt-3 block text-sm font-bold text-stone-700">
              Activity visibility
              <select className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" value={activityVisibility} onChange={(event) => setActivityVisibility(event.target.value as HumanType["activityVisibility"])}>
                <option value="owner_and_dog">Show owner and dog</option>
                <option value="dog_only">Show dog only</option>
                <option value="anonymous">Anonymous outside friends</option>
              </select>
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm font-bold text-stone-700">
              <input type="checkbox" checked={messagesEnabled} onChange={(event) => setMessagesEnabled(event.target.checked)} />
              Receive messages
            </label>
          </div>
          <button className="mt-4 w-full rounded-md bg-emerald-900 px-4 py-2 font-bold text-white">Save profile</button>
        </form>

        <div className="space-y-6">
          <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Friends and blocked users</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-md bg-stone-50 p-4">
                <h3 className="font-black">Friends</h3>
                <div className="mt-3 space-y-2">
                  {friends.friends.length === 0 && <p className="text-sm text-stone-600">No approved friends yet.</p>}
                  {friends.friends.map((friend) => (
                    <div className="flex items-center justify-between gap-3 rounded-md bg-white p-3" key={friend.id}>
                      <span className="min-w-0 truncate text-sm font-bold">{userLabel(friend.user)}</span>
                      <button className="rounded-md border border-red-200 px-3 py-2 text-sm font-bold text-red-700" type="button" onClick={() => removeFriend(friend.user.id)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                {friends.incomingRequests.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-black uppercase text-stone-500">Requests</h4>
                    <div className="mt-2 space-y-2">
                      {friends.incomingRequests.map((request) => (
                        <div className="rounded-md bg-white p-3" key={request.id}>
                          <p className="text-sm font-bold">{userLabel(request.user)}</p>
                          <div className="mt-2 flex gap-2">
                            <button className="rounded-md bg-emerald-900 px-3 py-2 text-sm font-bold text-white" type="button" onClick={() => respondToFriendRequest(request.id, true)}>
                              Accept
                            </button>
                            <button className="rounded-md border border-stone-300 px-3 py-2 text-sm font-bold text-stone-800" type="button" onClick={() => respondToFriendRequest(request.id, false)}>
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="rounded-md bg-stone-50 p-4">
                <h3 className="font-black">Blocked users</h3>
                <div className="mt-3 space-y-2">
                  {blockedUsers.length === 0 && <p className="text-sm text-stone-600">No blocked users.</p>}
                  {blockedUsers.map((user) => (
                    <div className="flex items-center justify-between gap-3 rounded-md bg-white p-3" key={user.id}>
                      <span className="min-w-0 truncate text-sm font-bold">{userLabel(user)}</span>
                      <button className="rounded-md border border-stone-300 px-3 py-2 text-sm font-bold text-stone-800" type="button" onClick={() => unblockUser(user.id)}>
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Dogs</h2>
            <form className="mt-4 grid gap-3 rounded-md bg-stone-50 p-4 md:grid-cols-2" onSubmit={addDog}>
              {newDog.avatarUrl && (
                <div className="flex items-center gap-3 md:col-span-2">
                  <ProfilePhotoPreview src={newDog.avatarUrl} label={newDog.name || "DG"} size="h-12 w-12" />
                  <p className="text-sm font-semibold text-stone-700">Dog photo preview</p>
                </div>
              )}
              <input className="rounded-md border border-stone-300 px-3 py-2" value={newDog.name} onChange={(event) => setNewDog({ ...newDog, name: event.target.value })} placeholder="Dog name" required />
              <input className="rounded-md border border-stone-300 px-3 py-2" value={newDog.breed} onChange={(event) => setNewDog({ ...newDog, breed: event.target.value })} placeholder="Breed or mix" />
              <select className="rounded-md border border-stone-300 px-3 py-2" value={newDog.size} onChange={(event) => setNewDog({ ...newDog, size: event.target.value })}>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="giant">Giant</option>
              </select>
              <input className="rounded-md border border-stone-300 px-3 py-2" value={newDog.avatarUrl} onChange={(event) => setNewDog({ ...newDog, avatarUrl: event.target.value })} placeholder="Dog photo URL" />
              <textarea className="min-h-20 rounded-md border border-stone-300 px-3 py-2 md:col-span-2" value={newDog.notes} onChange={(event) => setNewDog({ ...newDog, notes: event.target.value })} placeholder="Notes, play style, triggers, favorite games..." />
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={newDog.isFriendly} onChange={(event) => setNewDog({ ...newDog, isFriendly: event.target.checked })} /> Friendly</label>
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={newDog.isPuppy} onChange={(event) => setNewDog({ ...newDog, isPuppy: event.target.checked })} /> Puppy</label>
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={newDog.isPublic} onChange={(event) => setNewDog({ ...newDog, isPublic: event.target.checked })} /> Show on visits</label>
              <button className="rounded-md bg-emerald-900 px-4 py-2 font-bold text-white">Add dog</button>
            </form>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {dogs.length === 0 && <p className="rounded-md bg-stone-50 p-4 text-sm text-stone-600">No dogs yet.</p>}
              {dogs.map((dog) => {
                const draft = dogDrafts[dog.id] || dogDraftFromDog(dog);
                return (
                  <article className="rounded-lg border border-stone-200 p-4" key={dog.id}>
                    <div className="flex items-center gap-3">
                      <ProfilePhotoPreview src={draft.avatarUrl} label={draft.name || "DG"} size="h-12 w-12" />
                      <input className="min-w-0 flex-1 rounded-md border border-stone-300 px-3 py-2 font-bold" value={draft.name} onChange={(event) => setDogDrafts({ ...dogDrafts, [dog.id]: { ...draft, name: event.target.value } })} />
                    </div>
                    <input className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2" value={draft.avatarUrl} onChange={(event) => setDogDrafts({ ...dogDrafts, [dog.id]: { ...draft, avatarUrl: event.target.value } })} placeholder="Dog photo URL" />
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <input className="rounded-md border border-stone-300 px-3 py-2" value={draft.breed} onChange={(event) => setDogDrafts({ ...dogDrafts, [dog.id]: { ...draft, breed: event.target.value } })} placeholder="Breed" />
                      <select className="rounded-md border border-stone-300 px-3 py-2" value={draft.size} onChange={(event) => setDogDrafts({ ...dogDrafts, [dog.id]: { ...draft, size: event.target.value } })}>
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                        <option value="giant">Giant</option>
                      </select>
                    </div>
                    <textarea className="mt-3 min-h-20 w-full rounded-md border border-stone-300 px-3 py-2" value={draft.notes} onChange={(event) => setDogDrafts({ ...dogDrafts, [dog.id]: { ...draft, notes: event.target.value } })} placeholder="Dog notes" />
                    <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
                      <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isFriendly} onChange={(event) => setDogDrafts({ ...dogDrafts, [dog.id]: { ...draft, isFriendly: event.target.checked } })} /> Friendly</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isPuppy} onChange={(event) => setDogDrafts({ ...dogDrafts, [dog.id]: { ...draft, isPuppy: event.target.checked } })} /> Puppy</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isPublic} onChange={(event) => setDogDrafts({ ...dogDrafts, [dog.id]: { ...draft, isPublic: event.target.checked } })} /> Public</label>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button className="rounded-md bg-stone-900 px-3 py-2 text-sm font-bold text-white" type="button" onClick={() => saveDog(dog.id)}>Save</button>
                      <button className="rounded-md border border-red-200 px-3 py-2 text-sm font-bold text-red-700" type="button" onClick={() => removeDog(dog.id)}>Remove</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Visits</h2>
            <p className="mt-2 text-sm text-stone-600">Edit times, switch which dog is coming, check in, or cancel plans.</p>
            <div className="mt-4 space-y-4">
              {visits.length === 0 && <p className="rounded-md bg-stone-50 p-4 text-sm text-stone-600">No upcoming visits. <Link className="font-bold text-emerald-900 underline" to="/parks">Find a park</Link> to plan one.</p>}
              {visits.map((visit) => {
                const draft = visitDrafts[visit.id] || visitDraftFromVisit(visit);
                const parkName = visitParkNames[visit.park_ref] || visit.park_ref;
                const isRawParkRef = parkName === visit.park_ref;
                return (
                  <article className="rounded-lg border border-stone-200 p-4" key={visit.id}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-bold uppercase text-stone-500">Park</p>
                        <Link className="font-black text-emerald-900 underline underline-offset-4" to={`/parks/${encodeURIComponent(visit.park_ref)}`}>{parkName}</Link>
                        {!isRawParkRef && <p className="mt-1 text-xs font-semibold text-stone-500">Park ID: {visit.park_ref}</p>}
                        <p className="mt-1 text-sm text-stone-600">Status: {visit.status.replace("_", " ")}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {visit.status === "planned" && <button className="rounded-md bg-emerald-900 px-3 py-2 text-sm font-bold text-white" onClick={() => checkIn(visit.id)}>Check in</button>}
                        <button className="rounded-md border border-red-200 px-3 py-2 text-sm font-bold text-red-700" onClick={() => cancelVisit(visit.id)}>Cancel</button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <label className="block text-sm font-bold text-stone-700">
                        Time
                        <input className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" type="datetime-local" value={draft.startsAt} onChange={(event) => setVisitDrafts({ ...visitDrafts, [visit.id]: { ...draft, startsAt: event.target.value } })} />
                      </label>
                      <label className="block text-sm font-bold text-stone-700">
                        Duration
                        <input className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" type="number" min="15" step="15" value={draft.durationMinutes} onChange={(event) => setVisitDrafts({ ...visitDrafts, [visit.id]: { ...draft, durationMinutes: Number(event.target.value) } })} />
                      </label>
                      <label className="block text-sm font-bold text-stone-700">
                        Dog
                        <select className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" value={draft.dogId} onChange={(event) => setVisitDrafts({ ...visitDrafts, [visit.id]: { ...draft, dogId: event.target.value } })}>
                          <option value="">Dog not selected</option>
                          {dogs.map((dog) => <option value={dog.id} key={dog.id}>{dog.name || dog.dog_name}</option>)}
                        </select>
                      </label>
                    </div>
                    <label className="mt-3 block text-sm font-bold text-stone-700">
                      Social intent
                      <select className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" value={draft.socialIntent} onChange={(event) => setVisitDrafts({ ...visitDrafts, [visit.id]: { ...draft, socialIntent: event.target.value } })}>
                        <option value="">No preference</option>
                        <option value="Open to play">Open to play</option>
                        <option value="Small dog meetup">Small dog meetup</option>
                        <option value="Training/socializing">Training/socializing</option>
                        <option value="Just walking">Just walking</option>
                        <option value="Quiet visit">Quiet visit</option>
                      </select>
                    </label>
                    <textarea className="mt-3 min-h-16 w-full rounded-md border border-stone-300 px-3 py-2" value={draft.notes} onChange={(event) => setVisitDrafts({ ...visitDrafts, [visit.id]: { ...draft, notes: event.target.value } })} placeholder="Visit notes" />
                    <button className="mt-3 rounded-md bg-stone-900 px-3 py-2 text-sm font-bold text-white" onClick={() => saveVisit(visit.id)}>Save visit</button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default Account;
