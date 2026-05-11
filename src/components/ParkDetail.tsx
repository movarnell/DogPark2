import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, Review, Visit } from "../lib/api";
import { parkDisplayName } from "../lib/park";
import { getCompatibilitySummary, getVisitCompatibility, sortByCompatibility } from "../lib/visitCompatibility";
import { DogType } from "../types/DogType";
import { HumanType } from "../types/HumanType";
import { ParkType } from "../types/ParkType";

function visitOwnerName(visit: Visit) {
  return visit.owner_display_name || visit.username || visit.full_name || "Someone";
}

function visitDogLabel(visit: Visit) {
  return [visit.dog_name || "their dog", visit.dog_size, visit.dog_breed].filter(Boolean).join(" · ");
}

function dogDisplayName(dog?: DogType) {
  return dog?.name || dog?.dog_name || "your dog";
}

const strongChipClass = "inline-flex max-w-full items-center rounded-md bg-emerald-900 px-2.5 py-1 text-xs font-black leading-none text-white";
const softChipClass = "inline-flex max-w-full items-center rounded-md bg-stone-100 px-2.5 py-1 text-xs font-bold leading-none text-stone-700";
const socialChipClass = "inline-flex max-w-full items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold leading-none text-emerald-900";
const durationChipClass =
  "inline-flex max-w-full items-center whitespace-nowrap rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-black uppercase tracking-wide leading-none text-emerald-800";
const matchBadgeClass =
  "inline-flex h-8 min-w-[92px] shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-black leading-none shadow-sm";

function formatDuration(minutes?: number) {
  const safeMinutes = Number(minutes || 60);
  if (safeMinutes < 60) return `${safeMinutes} min`;
  if (safeMinutes === 60) return "1 hr";
  if (safeMinutes % 60 === 0) return `${safeMinutes / 60} hr`;
  return `${Math.floor(safeMinutes / 60)} hr ${safeMinutes % 60} min`;
}

function formatVisitTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatVisitDateTime(value: string) {
  return new Date(value).toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDatetimeLocal(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function formatBusyDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function DogVisitAvatar({ visit }: { visit: Visit }) {
  const [failed, setFailed] = useState(false);
  const label = (visit.dog_name || "DG").slice(0, 2).toUpperCase();
  const imageUrl = api.assetUrl(visit.dog_avatar_url);

  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-900 text-xs font-black text-white" aria-label={`${visit.dog_name || "Dog"} photo`}>
      {imageUrl && !failed ? (
        <img className="h-full w-full object-cover" src={imageUrl} alt={`${visit.dog_name || "Dog"} photo`} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        label
      )}
    </span>
  );
}

function SelectedDogAvatar({ dog }: { dog: DogType }) {
  const [failed, setFailed] = useState(false);
  const label = (dog.name || dog.dog_name || "DG").slice(0, 2).toUpperCase();
  const imageUrl = api.assetUrl(dog.avatarUrl);

  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-900 text-xs font-black text-white" aria-label={`${dogDisplayName(dog)} photo`}>
      {imageUrl && !failed ? (
        <img className="h-full w-full object-cover" src={imageUrl} alt={`${dogDisplayName(dog)} photo`} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        label
      )}
    </span>
  );
}

function BusyTimesCard({ busyTimes }: { busyTimes: NonNullable<ParkType["busyTimes"]> }) {
  const visibleDays = busyTimes?.days.slice(0, 7) || [];

  return (
    <div className="mt-5 rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-stone-500">Planned busy times</p>
          <h2 className="mt-1 text-xl font-black text-stone-950">Best windows over the next 2 weeks</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Based on member-posted visits and check-ins for this park.
          </p>
        </div>
        {busyTimes?.peak && (
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-950">
            Peak: {formatBusyDate(busyTimes.peak.date)} at {busyTimes.peak.hourLabel}
          </div>
        )}
      </div>
      <div className="mt-4 space-y-3">
        {visibleDays.map((day) => (
          <div className="grid gap-3 rounded-md border border-stone-100 bg-stone-50 p-3 sm:grid-cols-[120px_minmax(0,1fr)]" key={day.date}>
            <div>
              <p className="font-black text-stone-950">
                {day.weekday} {formatBusyDate(day.date)}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-stone-500">
                {day.totalDogs} {day.totalDogs === 1 ? "dog" : "dogs"} posted
              </p>
            </div>
            <div className="space-y-2">
              {day.slots.map((slot) => (
                <div className="grid grid-cols-[72px_minmax(0,1fr)_82px] items-center gap-3" key={`${day.date}-${slot.hour}`}>
                  <span className="text-sm font-bold text-stone-700">{slot.hourLabel}</span>
                  <span
                    className="h-3 overflow-hidden rounded-full bg-stone-200"
                    role="meter"
                    aria-label={`${slot.hourLabel}: ${slot.dogCount} ${slot.dogCount === 1 ? "dog" : "dogs"} planned`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={slot.intensity}
                  >
                    <span className="block h-full rounded-full bg-emerald-800" style={{ width: `${slot.intensity}%` }} />
                  </span>
                  <span className="text-right text-sm font-bold text-stone-700">
                    {slot.dogCount} {slot.dogCount === 1 ? "dog" : "dogs"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParkDetail({ signedInUser }: { signedInUser: HumanType | null }) {
  const { parkId = "" } = useParams();
  const navigate = useNavigate();
  const [park, setPark] = useState<(ParkType & { reviews?: Review[]; todayVisits?: Visit[]; upcomingVisits?: Visit[] }) | null>(null);
  const [dogs, setDogs] = useState<DogType[]>([]);
  const [selectedDogId, setSelectedDogId] = useState("");
  const [message, setMessage] = useState("");
  const [joiningVisitId, setJoiningVisitId] = useState("");
  const [visitStartsAt, setVisitStartsAt] = useState("");
  const [visitDurationMinutes, setVisitDurationMinutes] = useState(60);
  const [visitNote, setVisitNote] = useState("");
  const [socialIntent, setSocialIntent] = useState("Open to play");
  const [reviewBody, setReviewBody] = useState("");
  const [rating, setRating] = useState(5);
  const [suggestion, setSuggestion] = useState("");

  useEffect(() => {
    api
      .getPark(parkId)
      .then(setPark)
      .catch((error: Error) => setMessage(error.message));
  }, [parkId]);

  useEffect(() => {
    if (!signedInUser) {
      setDogs([]);
      setSelectedDogId("");
      return;
    }

    api
      .getDogs()
      .then((data) => {
        setDogs(data);
        setSelectedDogId((current) => current || data[0]?.id || "");
      })
      .catch(() => {
        setDogs([]);
        setSelectedDogId("");
      });
  }, [signedInUser]);

  useEffect(() => {
    if (!signedInUser || !selectedDogId) return;
    api
      .getPark(parkId, selectedDogId)
      .then(setPark)
      .catch((error: Error) => setMessage(error.message));
  }, [parkId, selectedDogId, signedInUser]);

  const mapSrc = useMemo(() => {
    if (park?.latitude && park.longitude) {
      return `https://maps.google.com/maps?q=${park.latitude},${park.longitude}&z=15&output=embed`;
    }
    return `https://maps.google.com/maps?q=${encodeURIComponent(park?.address || parkDisplayName(park || {}))}&output=embed`;
  }, [park]);
  const imageUrl = api.assetUrl(park?.photoUrl || park?.image_URL);
  const todayVisits = park?.todayVisits || [];
  const upcomingVisits = park?.upcomingVisits || [];
  const knownDogIds = new Set(todayVisits.map((visit) => visit.dog_id).filter(Boolean));
  const dogCount = knownDogIds.size || todayVisits.length;
  const ownerCount = signedInUser ? new Set(todayVisits.map((visit) => visit.owner_user_id).filter(Boolean)).size || todayVisits.length : todayVisits.length;
  const nextVisit = todayVisits[0];
  const signedOutDogTeaser =
    dogCount > 0
      ? `${dogCount} ${dogCount === 1 ? "dog is" : "dogs are"} already planned for this park today.`
      : "No dogs are posted for today yet. Be the first to create a social window.";
  const selectedDog = dogs.find((dog) => dog.id === selectedDogId);
  const signedInUserId = signedInUser ? String(signedInUser.id) : "";
  const selectedDogName = dogDisplayName(selectedDog);
  const todayCompatibility = getCompatibilitySummary(todayVisits, selectedDog);
  const upcomingCompatibility = getCompatibilitySummary(upcomingVisits, selectedDog);
  const totalCompatibilityCount = todayCompatibility.compatibleVisitCount + upcomingCompatibility.compatibleVisitCount;
  const rankedTodayVisits = sortByCompatibility(todayVisits, selectedDog);
  const rankedUpcomingVisits = sortByCompatibility(upcomingVisits, selectedDog);
  const bestWindow = todayCompatibility.bestMatch || upcomingCompatibility.bestMatch;
  const bestWindowCompatibility = todayCompatibility.bestMatch
    ? todayCompatibility.bestMatchCompatibility
    : upcomingCompatibility.bestMatchCompatibility;

  async function submitVisitPlan(startsAt = visitStartsAt) {
    if (!startsAt) {
      setMessage("Choose when you plan to visit.");
      return;
    }
    setMessage("");
    try {
      await api.createVisit({
        parkId,
        dogId: selectedDogId || undefined,
        startsAt,
        durationMinutes: visitDurationMinutes,
        notes: visitNote,
        socialIntent,
      });
      const refreshed = await api.getPark(parkId);
      setPark(refreshed);
      setVisitStartsAt("");
      setVisitNote("");
      setMessage("Visit posted. Other owners can now plan around when your dog will be here.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not post visit.");
    }
  }

  async function createVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await submitVisitPlan(String(formData.get("startsAt") || visitStartsAt));
  }

  async function clickCreateVisit(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    const form = event.currentTarget.form;
    const formData = form ? new FormData(form) : null;
    await submitVisitPlan(String(formData?.get("startsAt") || visitStartsAt));
  }

  function setQuickVisitTime(kind: "now" | "thirty" | "evening") {
    const date = new Date();
    if (kind === "thirty") {
      date.setMinutes(date.getMinutes() + 30);
    }
    if (kind === "evening") {
      date.setHours(18, 0, 0, 0);
    }
    setVisitStartsAt(toDatetimeLocal(date));
  }

  async function refreshPark() {
    setPark(await api.getPark(parkId, selectedDogId || undefined));
  }

  async function markInterested(visit: Visit) {
    setMessage("");
    try {
      if (visit.is_interested) {
        await api.uninterestVisit(visit.id);
        setMessage("Interest removed.");
      } else {
        await api.interestVisit(visit.id);
        setMessage("Interest sent.");
      }
      await refreshPark();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update interest.");
    }
  }

  async function startConversation(visit: Visit) {
    setMessage("");
    try {
      const conversation = await api.createConversation(visit.id);
      navigate(`/messages?conversation=${encodeURIComponent(conversation.id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start this conversation.");
    }
  }

  async function requestFriend(visit: Visit) {
    setMessage("");
    try {
      await api.sendFriendRequest({ visitId: visit.id });
      setMessage("Friend request sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send friend request.");
    }
  }

  async function blockOwner(visit: Visit) {
    setMessage("");
    try {
      await api.blockUser({ visitId: visit.id });
      await refreshPark();
      setMessage("Owner blocked.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not block this owner.");
    }
  }

  async function checkInVisit(visit: Visit) {
    setMessage("");
    try {
      await api.checkIn(visit.id);
      await refreshPark();
      setMessage("Checked in.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not check in.");
    }
  }

  async function joinVisitWindow(visit: Visit) {
    if (!signedInUser) {
      navigate("/login");
      return;
    }
    if (!selectedDogId) {
      setMessage("Add or select a dog before joining a play window.");
      navigate("/account");
      return;
    }

    setJoiningVisitId(visit.id);
    setMessage("");
    try {
      await api.createVisit({
        parkId,
        dogId: selectedDogId,
        startsAt: visit.starts_at,
        durationMinutes: visit.duration_minutes || 60,
        socialIntent: visit.social_intent || "Open to play",
        notes: `Joining ${visitOwnerName(visit)}'s play window.`,
      });
      await refreshPark();
      setMessage(`${selectedDog?.name || selectedDog?.dog_name || "Your dog"} is now planned for that play window.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not join this play window.");
    } finally {
      setJoiningVisitId("");
    }
  }

  async function createReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewBody.trim()) return;
    await api.createReview({ parkId, rating, body: reviewBody });
    const refreshed = await api.getPark(parkId);
    setPark(refreshed);
    setReviewBody("");
  }

  async function submitSuggestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await api.suggestParkEdit(parkId, { summary: suggestion });
    setSuggestion("");
    setMessage("Correction submitted for moderation.");
  }

  if (!park) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Link className="font-bold text-emerald-900" to="/parks">
          Back to parks
        </Link>
        <div className="mt-4 rounded-lg border border-stone-200 bg-white p-5">{message || "Loading park..."}</div>
      </main>
    );
  }

  const planVisitPanel = (
    <aside className="order-first rounded-lg border border-emerald-900 bg-emerald-950 p-5 text-white shadow-sm lg:order-none lg:sticky lg:top-4">
      <p className="text-sm font-black uppercase tracking-wide text-emerald-100">Start a meetup</p>
      <h2 className="mt-1 text-2xl font-black leading-tight">Plan a playdate at this park</h2>
      <p className="mt-2 text-sm leading-6 text-emerald-50">
        Post when you and your dog will arrive so nearby owners can overlap, say hello, and give the dogs a better chance to socialize.
      </p>
      {signedInUser ? (
        <form className="mt-4 space-y-3" onSubmit={createVisit}>
          <label className="block">
            <span className="text-sm font-bold text-emerald-50">Dog coming with you</span>
            <select
              className="mt-1 w-full rounded-md border border-emerald-700 bg-white px-3 py-2 text-stone-950"
              value={selectedDogId}
              onChange={(event) => setSelectedDogId(event.target.value)}
            >
              <option value="">Dog not selected</option>
              {dogs.map((dog) => (
                <option value={dog.id} key={dog.id}>
                  {dog.name || dog.dog_name}
                </option>
              ))}
            </select>
          </label>
          {selectedDog && (
            <div className="flex items-center gap-3 rounded-md bg-white/10 p-3">
              <SelectedDogAvatar dog={selectedDog} />
              <p className="text-sm font-semibold text-emerald-50">
                {selectedDogName} helps other owners decide whether this is a good play window.
              </p>
            </div>
          )}
          {selectedDog && (
            <div className="rounded-md bg-white/10 p-3 text-sm leading-5 text-emerald-50">
              <p className="font-black text-white">
                {totalCompatibilityCount > 0
                  ? `${totalCompatibilityCount} compatible ${totalCompatibilityCount === 1 ? "window" : "windows"} for ${selectedDogName}`
                  : `We will flag matches for ${selectedDogName}`}
              </p>
              <p className="mt-1">
                We rank same-size, preferred-size, energy, play style, and social comfort signals so you can pick the best overlap.
              </p>
              {bestWindow && (
                <div className="mt-3 rounded-md bg-white p-3 text-emerald-950">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-800">Best window for {selectedDogName}</p>
                  <p className="mt-1 font-black">
                    {formatVisitDateTime(bestWindow.starts_at)} with {bestWindow.dog_name || "another dog"}
                  </p>
                  {bestWindowCompatibility.labels.length > 0 && (
                    <p className="mt-1 text-sm font-semibold">{bestWindowCompatibility.labels.slice(0, 2).join(" · ")}</p>
                  )}
                </div>
              )}
            </div>
          )}
          {dogs.length === 0 && (
            <p className="rounded-md bg-amber-100 p-3 text-sm font-semibold leading-5 text-amber-950">
              Add your dog in Account so other owners know who is coming.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2">
            <button className="rounded-md border border-emerald-600 px-2 py-2 text-sm font-bold text-white hover:bg-white/10" type="button" aria-label="Set visit time to now" onClick={() => setQuickVisitTime("now")}>
              Now
            </button>
            <button className="rounded-md border border-emerald-600 px-2 py-2 text-sm font-bold text-white hover:bg-white/10" type="button" aria-label="Set visit time to 30 minutes from now" onClick={() => setQuickVisitTime("thirty")}>
              In 30 min
            </button>
            <button className="rounded-md border border-emerald-600 px-2 py-2 text-sm font-bold text-white hover:bg-white/10" type="button" aria-label="Set visit time to this evening" onClick={() => setQuickVisitTime("evening")}>
              This evening
            </button>
          </div>
          <label className="block">
            <span className="text-sm font-bold text-emerald-50">Arrival time</span>
            <input
              className="mt-1 w-full rounded-md border border-emerald-700 bg-white px-3 py-2 text-stone-950"
              type="datetime-local"
              name="startsAt"
              value={visitStartsAt}
              onChange={(event) => setVisitStartsAt(event.target.value)}
              onInput={(event) => setVisitStartsAt(event.currentTarget.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <label className="block">
              <span className="text-sm font-bold text-emerald-50">How long</span>
              <select
                className="mt-1 w-full rounded-md border border-emerald-700 bg-white px-3 py-2 text-stone-950"
                value={visitDurationMinutes}
                onChange={(event) => setVisitDurationMinutes(Number(event.target.value))}
              >
                <option value={30}>30 min</option>
                <option value={60}>1 hr</option>
                <option value={90}>1.5 hr</option>
                <option value={120}>2 hr</option>
                <option value={180}>3 hr</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-bold text-emerald-50">Vibe</span>
              <select
                className="mt-1 w-full rounded-md border border-emerald-700 bg-white px-3 py-2 text-stone-950"
                value={socialIntent}
                onChange={(event) => setSocialIntent(event.target.value)}
              >
                <option value="Open to play">Open to play</option>
                <option value="Small dog meetup">Small dog meetup</option>
                <option value="Training/socializing">Training/socializing</option>
                <option value="Just walking">Just walking</option>
                <option value="Quiet visit">Quiet visit</option>
              </select>
            </label>
          </div>
          <textarea
            className="min-h-20 w-full rounded-md border border-emerald-700 bg-white px-3 py-2 text-stone-950"
            placeholder="Optional note: play style, where you will be, or what kind of dog interaction works best."
            aria-label="Optional visit note"
            value={visitNote}
            onChange={(event) => setVisitNote(event.target.value)}
          />
          <button className="w-full rounded-md bg-white px-4 py-3 font-black text-emerald-950 hover:bg-emerald-50" type="button" onClick={clickCreateVisit}>
            Let other owners know
          </button>
        </form>
      ) : (
        <Link className="mt-4 block rounded-md bg-white px-4 py-3 text-center font-black text-emerald-950 hover:bg-emerald-50" to="/login">
          Sign in to schedule a social visit
        </Link>
      )}
      <p className="mt-4 text-xs font-semibold leading-5 text-emerald-100">
        The more owners post their plans, the easier it is to find a friendly overlap for play, training, or a calmer walk.
      </p>
    </aside>
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <Link className="font-bold text-emerald-900" to="/parks">
        Back to parks
      </Link>
      {message && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">{message}</p>}
      <section className="mt-4 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start">
          <div>
            {imageUrl && <img className="mb-5 h-52 w-full rounded-lg object-cover sm:h-64" src={imageUrl} alt={parkDisplayName(park)} />}
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">{park.source || "Park"} profile</p>
            <h1 className="mt-1 text-4xl font-black tracking-tight">{parkDisplayName(park)}</h1>
            <p className="mt-3 text-stone-600">{park.address}</p>
            <p className="mt-3 max-w-2xl text-base leading-7 text-stone-700">
              This page is for turning a park listing into a social plan. Add your visit time so other owners can bring compatible dogs at the same time instead of hoping for a good crowd by chance.
            </p>
            <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-wide text-emerald-900">Today at this park</p>
                  <p className="mt-1 text-sm text-emerald-950">
                    {signedInUser
                      ? "See whether there is already a good social window, or post yours to create one."
                      : signedOutDogTeaser}
                  </p>
                </div>
                {!signedInUser && (
                  <Link className="rounded-md bg-emerald-950 px-3 py-2 text-sm font-black text-white hover:bg-emerald-900" to="/login">
                    See details
                  </Link>
                )}
              </div>
              <div className={`mt-4 grid gap-3 ${signedInUser ? "sm:grid-cols-3" : "sm:grid-cols-[1.3fr_1fr]"}`}>
                {signedInUser && (
                  <div>
                    <p className="text-3xl font-black text-emerald-950">{ownerCount}</p>
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">
                      {ownerCount === 1 ? "Owner going" : "Owners going"}
                    </p>
                  </div>
                )}
                <div>
                  <p className={signedInUser ? "text-3xl font-black text-emerald-950" : "text-5xl font-black leading-none text-emerald-950"}>{dogCount}</p>
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">
                    {dogCount === 1 ? "Dog coming today" : "Dogs coming today"}
                  </p>
                </div>
                <div>
                  {signedInUser ? (
                    <>
                      <p className="text-base font-black text-emerald-950">
                        {nextVisit ? new Date(nextVisit.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "No plans yet"}
                      </p>
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">Next meetup</p>
                    </>
                  ) : (
                    <>
                      <p className="text-base font-black text-emerald-950">{dogCount > 0 ? "Details locked" : "Start the day"}</p>
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">
                        {dogCount > 0 ? "Sign in for times and play styles" : "Sign in to post your visit"}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-emerald-950">
                {signedInUser
                  ? "These counts are private to signed-in members and come from owners posting planned visits for today."
                  : "Sign in to see visit times, dog profiles, social intent, and owner details so you can choose the best overlap for your dog."}
              </p>
              {!signedInUser && dogCount > 0 && (
                <div className="mt-4 rounded-md border border-emerald-200 bg-white/80 p-3">
                  <p className="text-sm font-black text-emerald-950">Want your dog to meet them?</p>
                  <p className="mt-1 text-sm leading-5 text-emerald-900">
                    Create an account to see when the dogs are coming and add your own visit so other owners can plan around you too.
                  </p>
                </div>
              )}
              {signedInUser && (
                <div className="mt-4 space-y-3">
                  {selectedDog && todayVisits.length > 0 && (
                    <div className="rounded-md border border-emerald-200 bg-white/80 p-3">
                      <div className="flex gap-3">
                        <SelectedDogAvatar dog={selectedDog} />
                        <div className="min-w-0">
                          <p className="text-sm font-black text-emerald-950">
                            {todayCompatibility.compatibleVisitCount > 0
                              ? `${selectedDogName} has ${todayCompatibility.compatibleVisitCount} compatible ${todayCompatibility.compatibleVisitCount === 1 ? "visit" : "visits"} today.`
                              : `No breed or size matches posted for ${selectedDogName} yet today.`}
                          </p>
                          <p className="mt-1 text-sm leading-5 text-emerald-900">
                            {todayCompatibility.bestMatch
                              ? `Best current match starts at ${formatVisitTime(todayCompatibility.bestMatch.starts_at)} with a ${todayCompatibility.bestMatchCompatibility.score}% fit.`
                              : "Post your plan anyway so owners with compatible dogs know when to overlap."}
                          </p>
                        </div>
                      </div>
                      {todayCompatibility.bestMatch && (
                        <div className="mt-3 flex items-center gap-3 rounded-md bg-white p-2">
                          <DogVisitAvatar visit={todayCompatibility.bestMatch} />
                          <p className="min-w-0 text-sm font-semibold leading-5 text-emerald-950">
                            Matching with {todayCompatibility.bestMatch.dog_name || "another dog"} from {visitOwnerName(todayCompatibility.bestMatch)}'s visit.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {todayVisits.length === 0 && (
                    <p className="rounded-md bg-white/70 p-3 text-sm font-semibold text-emerald-950">
                      No one has posted for today yet. Add your plan below to start a meetup window.
                    </p>
                  )}
                  {rankedTodayVisits.map((visit) => {
                    const isOwnVisit = signedInUserId && String(visit.owner_user_id) === signedInUserId;
                    const compatibility = getVisitCompatibility(visit, selectedDog);
                    const hasCompatibility = compatibility.score > 0;
                    return (
                      <article
                        className={`rounded-lg border bg-white p-3 ${hasCompatibility ? "border-emerald-500 shadow-sm ring-2 ring-emerald-100" : "border-emerald-100"}`}
                        key={visit.id}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 gap-3">
                            <DogVisitAvatar visit={visit} />
                            <div className="min-w-0">
                              <p className="font-black text-stone-950">
                                {formatVisitTime(visit.starts_at)} for about {formatDuration(visit.duration_minutes)}
                              </p>
                              <p className="mt-1 text-sm text-stone-700">
                                {visitOwnerName(visit)} is bringing {visitDogLabel(visit)}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {compatibility.labels.map((label) => (
                                  <span className={strongChipClass} key={label}>
                                    {label}
                                  </span>
                                ))}
                                {hasCompatibility && (
                                  <span className="inline-flex max-w-full items-center rounded-md bg-emerald-900 px-2.5 py-1 text-xs font-black leading-none text-white">
                                    {compatibility.score}% fit
                                  </span>
                                )}
                                {visit.social_intent && (
                                  <span className={socialChipClass}>
                                    {visit.social_intent}
                                  </span>
                                )}
                                <span className={softChipClass}>
                                  {visit.status.replace("_", " ")}
                                </span>
                                {Number(visit.interest_count || 0) > 0 && (
                                  <span className="inline-flex max-w-full items-center rounded-md bg-sky-50 px-2.5 py-1 text-xs font-bold leading-none text-sky-900">
                                    {visit.interest_count} interested
                                  </span>
                                )}
                              </div>
                              {hasCompatibility && (
                                <p className="mt-2 text-sm font-semibold leading-5 text-emerald-900">
                                  This looks like a stronger park window for {selectedDogName}.
                                </p>
                              )}
                              {compatibility.cautions.length > 0 && (
                                <p className="mt-2 text-sm font-semibold leading-5 text-amber-800">
                                  {compatibility.cautions.join(" · ")}
                                </p>
                              )}
                              {visit.notes && <p className="mt-2 text-sm leading-5 text-stone-600">{visit.notes}</p>}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            {isOwnVisit ? (
                              visit.status === "planned" && (
                                <button
                                  className="rounded-md bg-emerald-900 px-3 py-2 text-sm font-bold text-white"
                                  type="button"
                                  aria-label={`Check in now for ${visitDogLabel(visit)}`}
                                  onClick={() => checkInVisit(visit)}
                                >
                                  Check in now
                                </button>
                              )
                            ) : (
                              <>
                                {visit.can_message && (
                                  <button
                                    className="rounded-md bg-emerald-900 px-3 py-2 text-sm font-bold text-white"
                                    type="button"
                                    aria-label={`Message ${visitOwnerName(visit)}`}
                                    onClick={() => startConversation(visit)}
                                  >
                                    Message
                                  </button>
                                )}
                                <button
                                  className="rounded-md border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-900"
                                  type="button"
                                  aria-label={`${visit.is_interested ? "Remove interest in" : "Mark interest in"} ${visitDogLabel(visit)} visit`}
                                  onClick={() => markInterested(visit)}
                                >
                                  {visit.is_interested ? "Interested" : "I'm interested"}
                                </button>
                                {visit.can_request_friend && !visit.is_friend && (
                                  <button
                                    className="rounded-md border border-stone-300 px-3 py-2 text-sm font-bold text-stone-800"
                                    type="button"
                                    aria-label={`Send friend request to ${visitOwnerName(visit)}`}
                                    onClick={() => requestFriend(visit)}
                                  >
                                    Add friend
                                  </button>
                                )}
                                {visit.can_block && (
                                  <button
                                    className="rounded-md border border-red-200 px-3 py-2 text-sm font-bold text-red-700"
                                    type="button"
                                    aria-label={`Block ${visitOwnerName(visit)}`}
                                    onClick={() => blockOwner(visit)}
                                  >
                                    Block
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
            {signedInUser && park.busyTimes?.days.length ? <BusyTimesCard busyTimes={park.busyTimes} /> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {park.rating && <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">{park.rating.toFixed(1)} rating</span>}
              {park.userRatingCount !== undefined && (
                <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-bold text-stone-700">{park.userRatingCount} Google reviews</span>
              )}
              {park.websiteUri && (
                <a className="rounded-full bg-stone-900 px-3 py-1 text-sm font-bold text-white" href={park.websiteUri}>
                  Website
                </a>
              )}
              {park.googleMapsUri && (
                <a className="rounded-full bg-emerald-900 px-3 py-1 text-sm font-bold text-white" href={park.googleMapsUri}>
                  Open in Google Maps
                </a>
              )}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ["Fence", park.community?.fenceStatus || "Community confirmation needed"],
                ["Surface", park.community?.surface || "Community confirmation needed"],
                ["Water", park.community?.waterAvailable ? "Available" : "Unknown"],
                ["Shade", park.community?.shadeAvailable ? "Available" : "Unknown"],
              ].map(([label, value]) => (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4" key={label}>
                  <p className="text-xs font-bold uppercase text-stone-500">{label}</p>
                  <p className="mt-1 font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>
          {planVisitPanel}
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Upcoming</p>
          <h2 className="mt-1 text-xl font-black">Join a play window</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Pick a time that already has momentum. One tap adds your dog to the same window so owners can show up together.
          </p>
          {signedInUser && selectedDog && (
            <div className="mt-4 rounded-md border border-emerald-100 bg-emerald-50 p-3">
              <div className="flex gap-3">
                <SelectedDogAvatar dog={selectedDog} />
                <div className="min-w-0">
                  <p className="text-sm font-black text-emerald-950">
                    {upcomingCompatibility.compatibleVisitCount > 0
                      ? `${upcomingCompatibility.compatibleVisitCount} upcoming ${upcomingCompatibility.compatibleVisitCount === 1 ? "window matches" : "windows match"} ${selectedDogName}.`
                      : `No upcoming breed or size matches for ${selectedDogName} yet.`}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-emerald-900">
                    The strongest windows combine size fit, preferred playmates, energy, play style, and social comfort.
                  </p>
                </div>
              </div>
              {upcomingCompatibility.bestMatch && (
                <div className="mt-3 flex items-center gap-3 rounded-md bg-white p-2">
                  <DogVisitAvatar visit={upcomingCompatibility.bestMatch} />
                  <p className="min-w-0 text-sm font-semibold leading-5 text-emerald-950">
                    Matching with {upcomingCompatibility.bestMatch.dog_name || "another dog"} from {visitOwnerName(upcomingCompatibility.bestMatch)}'s play window.
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="mt-5 space-y-3">
            {(park.upcomingVisits || []).length === 0 && (
              <p className="rounded-md bg-stone-50 p-3 text-sm text-stone-600">
                No one has posted a planned visit yet. Be the first to start a meetup window.
              </p>
            )}
            {rankedUpcomingVisits.map((visit) => {
              const isOwnVisit = signedInUserId && String(visit.owner_user_id) === signedInUserId;
              const compatibility = getVisitCompatibility(visit, selectedDog);
              const hasCompatibility = compatibility.score > 0;
              return (
                <div
                  className={`rounded-lg border bg-white p-4 text-sm shadow-sm ${hasCompatibility ? "border-emerald-500 ring-2 ring-emerald-100" : "border-stone-200"}`}
                  key={visit.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <DogVisitAvatar visit={visit} />
                      <div className="min-w-0">
                        <p className="font-black text-stone-950">{formatVisitDateTime(visit.starts_at)}</p>
                        <p className="mt-1 text-stone-700">
                          {visitOwnerName(visit)} is bringing {visitDogLabel(visit)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {compatibility.labels.map((label) => (
                            <span className={strongChipClass} key={label}>
                              {label}
                            </span>
                          ))}
                          {hasCompatibility && (
                            <span className="inline-flex max-w-full items-center rounded-md bg-emerald-900 px-2.5 py-1 text-xs font-black leading-none text-white">
                              {compatibility.score}% fit
                            </span>
                          )}
                          <span className={durationChipClass}>
                            {formatDuration(visit.duration_minutes)} window
                          </span>
                          {visit.social_intent && (
                            <span className={softChipClass}>
                              {visit.social_intent}
                            </span>
                          )}
                        </div>
                        {hasCompatibility && (
                          <p className="mt-2 text-sm font-semibold leading-5 text-emerald-900">
                            A better-fit social window for {selectedDogName}.
                          </p>
                        )}
                        {compatibility.cautions.length > 0 && (
                          <p className="mt-2 text-sm font-semibold leading-5 text-amber-800">
                            {compatibility.cautions.join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`${matchBadgeClass} ${hasCompatibility ? "bg-emerald-900 text-white" : "border border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
                      {hasCompatibility ? "Best match" : "Open to join"}
                    </span>
                  </div>
                  <div className="mt-3 border-t border-stone-100 pt-3">
                    {isOwnVisit ? (
                      <p className="rounded-md bg-stone-50 px-3 py-2 text-center text-sm font-bold text-stone-700">
                        You're already in this play window
                      </p>
                    ) : signedInUser && dogs.length > 0 ? (
                      <button
                        className="w-full rounded-md bg-emerald-900 px-3 py-2 text-sm font-black text-white hover:bg-emerald-950 disabled:opacity-60"
                        type="button"
                        disabled={joiningVisitId === visit.id}
                        aria-label={`Bring ${selectedDogName} to ${visitOwnerName(visit)}'s play window on ${formatVisitDateTime(visit.starts_at)}`}
                        onClick={() => joinVisitWindow(visit)}
                      >
                        {joiningVisitId === visit.id ? "Adding..." : hasCompatibility ? `Bring ${selectedDogName} to this match` : `Bring ${selectedDogName} at this time`}
                      </button>
                    ) : signedInUser ? (
                      <Link className="block rounded-md border border-emerald-200 px-3 py-2 text-center text-sm font-black text-emerald-900" to="/account">
                        Add a dog to join this window
                      </Link>
                    ) : (
                      <Link className="block rounded-md bg-emerald-900 px-3 py-2 text-center text-sm font-black text-white" to="/login">
                        Sign in to join this play window
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 overflow-hidden rounded-lg border border-stone-200">
            <iframe className="h-64 w-full" src={mapSrc} title={`${parkDisplayName(park)} map`} loading="lazy" />
          </div>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-xl font-black">Community notes</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Help neighbors decide when to come by sharing crowd size, play style, amenities, and current conditions.
          </p>
          {signedInUser && (
            <form className="mt-4 grid gap-3" onSubmit={createReview}>
              <label className="block text-sm font-bold text-stone-700">
                Rating
                <select className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" value={rating} onChange={(event) => setRating(Number(event.target.value))}>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option value={value} key={value}>
                      {value} stars
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-bold text-stone-700">
                Community note
                <textarea
                  className="mt-1 min-h-24 w-full rounded-md border border-stone-300 px-3 py-2"
                  placeholder="Share whether it was social, busy, quiet, muddy, shaded, safe, or good for certain dog sizes..."
                  value={reviewBody}
                  onChange={(event) => setReviewBody(event.target.value)}
                />
              </label>
              <button className="rounded-md bg-stone-900 px-4 py-2 font-bold text-white">Post community note</button>
            </form>
          )}
          <div className="mt-5 space-y-4">
            {(park.reviews || []).map((review) => (
              <article className="rounded-lg border border-stone-200 p-4" key={review.id}>
                <p className="font-black">{review.rating} stars</p>
                <p className="mt-2 text-stone-700">{review.body}</p>
                <p className="mt-3 text-xs font-bold uppercase text-stone-500">{review.username || review.full_name}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {signedInUser && (
        <form className="mt-6 rounded-lg border border-stone-200 bg-white p-5 shadow-sm" onSubmit={submitSuggestion}>
          <h2 className="text-xl font-black">Correct this park</h2>
          <label className="mt-3 block text-sm font-bold text-stone-700">
            Correction details
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-stone-300 px-3 py-2"
              placeholder="Tell moderators what should be updated."
              value={suggestion}
              onChange={(event) => setSuggestion(event.target.value)}
            />
          </label>
          <button className="mt-3 rounded-md bg-emerald-900 px-4 py-2 font-bold text-white">Submit correction</button>
        </form>
      )}
    </main>
  );
}

export default ParkDetail;
