import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Review, Visit } from "../lib/api";

function visitDogLabel(visit: Visit) {
  return [visit.dog_name || "their dog", visit.dog_size, visit.dog_breed].filter(Boolean).join(" · ");
}

function visitOwnerLabel(visit: Visit) {
  return visit.owner_display_name || visit.username || visit.full_name || "Owner";
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

function Community() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([api.getVisits(), api.getReviews()])
      .then(([visitData, reviewData]) => {
        setVisits(visitData);
        setReviews(reviewData);
      })
      .catch((error: Error) => setMessage(error.message));
  }, []);

  async function checkIn(visitId: string) {
    await api.checkIn(visitId);
    setVisits((current) =>
      current.map((visit) => (visit.id === visitId ? { ...visit, status: "checked_in" } : visit)),
    );
  }

  async function startConversation(visit: Visit) {
    try {
      const conversation = await api.createConversation(visit.id);
      navigate(`/messages?conversation=${encodeURIComponent(conversation.id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start this conversation.");
    }
  }

  async function requestFriend(visit: Visit) {
    try {
      await api.sendFriendRequest({ visitId: visit.id });
      setMessage("Friend request sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send friend request.");
    }
  }

  async function blockOwner(visit: Visit) {
    try {
      await api.blockUser({ visitId: visit.id });
      setVisits((current) => current.filter((item) => item.id !== visit.id));
      setMessage("Owner blocked.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not block this owner.");
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Community schedule</p>
        <h1 className="mt-1 text-3xl font-black">See who is planning to be at the park</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
          Upcoming visits help owners pick a time when dogs can meet, play, and become familiar park friends. Check in
          when you arrive so the community knows the park is active right now.
        </p>
        {message && <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">{message}</p>}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Upcoming visits</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Use these plans to find overlap before you leave home.
          </p>
          <div className="mt-4 space-y-3">
            {visits.length === 0 && <p className="text-stone-600">No upcoming visits yet. Schedule one from a park page.</p>}
            {visits.map((visit) => (
              <article className="rounded-lg border border-stone-200 p-4" key={visit.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <DogVisitAvatar visit={visit} />
                    <div className="min-w-0">
                      <p className="font-black">{new Date(visit.starts_at).toLocaleString()}</p>
                      <p className="mt-1 text-sm text-stone-600">
                        {visitOwnerLabel(visit)} plans to bring {visitDogLabel(visit)} · {visit.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {visit.can_message && (
                      <button className="rounded-md bg-emerald-900 px-3 py-2 text-sm font-bold text-white" type="button" aria-label={`Message ${visitOwnerLabel(visit)}`} onClick={() => startConversation(visit)}>
                        Message
                      </button>
                    )}
                    {visit.can_request_friend && !visit.is_friend && (
                      <button className="rounded-md border border-stone-300 px-3 py-2 text-sm font-bold text-stone-800" type="button" aria-label={`Send friend request to ${visitOwnerLabel(visit)}`} onClick={() => requestFriend(visit)}>
                        Add friend
                      </button>
                    )}
                    {visit.can_block && (
                      <button className="rounded-md border border-red-200 px-3 py-2 text-sm font-bold text-red-700" type="button" aria-label={`Block ${visitOwnerLabel(visit)}`} onClick={() => blockOwner(visit)}>
                        Block
                      </button>
                    )}
                    {visit.status === "planned" && (
                      <button className="rounded-md border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-900" type="button" aria-label={`Check in to ${visitOwnerLabel(visit)}'s visit`} onClick={() => checkIn(visit.id)}>
                        Check in
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Recent community notes</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Owners can share whether a park was social, quiet, crowded, muddy, shaded, or better for certain dog sizes.
          </p>
          <div className="mt-4 space-y-3">
            {reviews.length === 0 && <p className="text-stone-600">No community notes posted yet.</p>}
            {reviews.map((review) => (
              <article className="rounded-lg border border-stone-200 p-4" key={review.id}>
                <p className="font-black">{review.rating} stars</p>
                <p className="mt-2 text-sm leading-6 text-stone-700">{review.body}</p>
                <p className="mt-2 text-xs font-bold uppercase text-stone-500">{review.username || review.full_name}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default Community;
