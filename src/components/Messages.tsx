import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, Conversation, DirectMessage, FriendsResponse } from "../lib/api";
import { HumanType } from "../types/HumanType";

function userLabel(user?: { username?: string; fullName?: string }) {
  return user?.fullName || user?.username || "Owner";
}

function emptyFriends(): FriendsResponse {
  return { friends: [], incomingRequests: [], outgoingRequests: [] };
}

function Messages({ signedInUser }: { signedInUser: HumanType | null }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [friends, setFriends] = useState<FriendsResponse>(emptyFriends);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [searchParams] = useSearchParams();

  const refreshShell = useCallback(async () => {
    const [conversationData, friendData] = await Promise.all([api.getConversations(), api.getFriends()]);
    const requestedConversationId = searchParams.get("conversation") || "";
    setConversations(conversationData);
    setFriends(friendData);
    setActiveConversationId((current) => requestedConversationId || current || conversationData[0]?.id || "");
  }, [searchParams]);

  useEffect(() => {
    refreshShell().catch((error: Error) => setMessage(error.message));
  }, [refreshShell]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    api
      .getMessages(activeConversationId)
      .then(setMessages)
      .catch((error: Error) => setMessage(error.message));
  }, [activeConversationId]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeConversationId || !draft.trim()) return;
    setMessage("");
    try {
      const sent = await api.sendMessage(activeConversationId, draft.trim());
      setMessages((current) => [...current, sent]);
      setDraft("");
      await refreshShell();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send message.");
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
      await refreshShell();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update friend request.");
    }
  }

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
  const signedInUserId = signedInUser ? String(signedInUser.id) : "";

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Messages</p>
        <h1 className="mt-1 text-3xl font-black">Inbox and friend requests</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
          Conversations stay available after the park visit that started them unless someone blocks the other person or turns messages off.
        </p>
        {message && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{message}</p>}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-xl font-black">Conversations</h2>
            <div className="mt-4 space-y-2">
              {conversations.length === 0 && <p className="rounded-md bg-stone-50 p-3 text-sm text-stone-600">No conversations yet.</p>}
              {conversations.map((conversation) => (
                <button
                  className={`w-full rounded-md border px-3 py-2 text-left ${
                    conversation.id === activeConversationId ? "border-emerald-700 bg-emerald-50" : "border-stone-200 bg-white"
                  }`}
                  key={conversation.id}
                  type="button"
                  onClick={() => setActiveConversationId(conversation.id)}
                >
                  <span className="block font-bold text-stone-950">{userLabel(conversation.otherUser)}</span>
                  <span className="mt-1 block truncate text-sm text-stone-600">{conversation.latestBody || "No messages yet"}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-xl font-black">Friend requests</h2>
            <div className="mt-4 space-y-3">
              {friends.incomingRequests.length === 0 && <p className="text-sm text-stone-600">No incoming requests.</p>}
              {friends.incomingRequests.map((request) => (
                <article className="rounded-md border border-stone-200 p-3" key={request.id}>
                  <p className="font-bold">{userLabel(request.user)}</p>
                  <div className="mt-3 flex gap-2">
                    <button className="rounded-md bg-emerald-900 px-3 py-2 text-sm font-bold text-white" type="button" onClick={() => respondToFriendRequest(request.id, true)}>
                      Accept
                    </button>
                    <button className="rounded-md border border-stone-300 px-3 py-2 text-sm font-bold text-stone-800" type="button" onClick={() => respondToFriendRequest(request.id, false)}>
                      Decline
                    </button>
                  </div>
                </article>
              ))}
              {friends.outgoingRequests.length > 0 && (
                <div className="rounded-md bg-stone-50 p-3">
                  <p className="text-sm font-bold text-stone-700">Sent requests</p>
                  <p className="mt-1 text-sm text-stone-600">{friends.outgoingRequests.map((request) => userLabel(request.user)).join(", ")}</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          {activeConversation ? (
            <>
              <h2 className="text-xl font-black">{userLabel(activeConversation.otherUser)}</h2>
              <div className="mt-4 flex min-h-96 flex-col gap-3 rounded-md bg-stone-50 p-4">
                {messages.length === 0 && <p className="text-sm text-stone-600">No messages yet.</p>}
                {messages.map((item) => {
                  const mine = signedInUserId && String(item.sender_user_id) === signedInUserId;
                  return (
                    <div className={`max-w-[82%] rounded-lg px-3 py-2 text-sm ${mine ? "ml-auto bg-emerald-900 text-white" : "bg-white text-stone-800"}`} key={item.id}>
                      {item.body}
                    </div>
                  );
                })}
              </div>
              <form className="mt-4 flex gap-2" onSubmit={sendMessage}>
                <input
                  className="min-w-0 flex-1 rounded-md border border-stone-300 px-3 py-2"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write a message"
                />
                <button className="rounded-md bg-emerald-900 px-4 py-2 font-bold text-white">Send</button>
              </form>
            </>
          ) : (
            <p className="rounded-md bg-stone-50 p-4 text-sm text-stone-600">Start a conversation from a same-day park visit.</p>
          )}
        </section>
      </section>
    </main>
  );
}

export default Messages;
