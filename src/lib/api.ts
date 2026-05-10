import { DogType } from "../types/DogType";
import { HumanType } from "../types/HumanType";
import { ParkType } from "../types/ParkType";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4050";
const APPLE_SIGN_IN_ENABLED = import.meta.env.VITE_ENABLE_APPLE_SIGN_IN === "true";

function assetUrl(path?: string) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export interface ParkSearchResponse {
  results: ParkType[];
  nextPageToken: string | null;
  googleAttributionRequired: boolean;
  searchArea?: {
    label: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    radiusMiles: number;
  } | null;
  warning?: string;
}

export interface Visit {
  id: string;
  owner_user_id?: string | number;
  owner_display_name?: string;
  park_ref: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
  notes?: string;
  social_intent?: string;
  username?: string;
  full_name?: string;
  dog_id?: string;
  dog_name?: string;
  dog_size?: string;
  dog_breed?: string;
  dog_breed_key?: string;
  dog_avatar_url?: string;
  dog_energy_level?: string;
  dog_play_style?: string;
  dog_social_comfort?: string;
  dog_preferred_sizes?: string[];
  compatibility?: {
    score: number;
    tier: "best" | "good" | "open";
    reasons: string[];
    cautions: string[];
  };
  interest_count?: number;
  is_interested?: boolean | number;
  can_message?: boolean;
  can_request_friend?: boolean;
  can_block?: boolean;
  is_friend?: boolean;
}

export interface Review {
  id: string;
  park_ref: string;
  rating: number;
  title?: string;
  body: string;
  helpful_count?: number;
  created_at?: string;
  username?: string;
  full_name?: string;
}

export interface Report {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details?: string;
  status: string;
  reporter_username?: string;
  created_at?: string;
}

export interface UserBrief {
  id: string | number;
  username: string;
  fullName?: string;
  avatarUrl?: string;
  createdAt?: string | null;
}

export interface FriendshipItem {
  id: string;
  status: string;
  user: UserBrief;
  createdAt?: string;
}

export interface FriendsResponse {
  friends: FriendshipItem[];
  incomingRequests: FriendshipItem[];
  outgoingRequests: FriendshipItem[];
}

export interface Conversation {
  id: string;
  otherUser: UserBrief;
  latestBody?: string;
  latestAt?: string;
  createdAt?: string;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_user_id: string | number;
  body: string;
  read_at?: string | null;
  created_at?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || "Request failed");
  }
  return data as T;
}

async function uploadMedia(file: File, purpose = "profile_photo") {
  const response = await fetch(`${API_BASE_URL}/api/media?purpose=${encodeURIComponent(purpose)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || "Photo upload failed");
  }
  return data as { id: string; url: string; mimeType: string; byteSize: number };
}

export const api = {
  baseUrl: API_BASE_URL,
  assetUrl,
  googleSignInUrl: `${API_BASE_URL}/api/owners/google`,
  appleSignInUrl: `${API_BASE_URL}/api/owners/apple`,
  appleSignInEnabled: APPLE_SIGN_IN_ENABLED,
  me: () => request<HumanType>("/api/me"),
  updateMe: (body: Partial<HumanType>) => request<HumanType>("/api/me", { method: "PATCH", body }),
  login: (body: { email: string; password: string }) =>
    request<HumanType>("/api/owners/login", { method: "POST", body }),
  register: (body: { fullName: string; email: string; username: string; password: string }) =>
    request<HumanType>("/api/owners/register", { method: "POST", body }),
  logout: () => request<void>("/api/owners/logout", { method: "POST" }),
  searchParks: (params: URLSearchParams) => request<ParkSearchResponse>(`/api/parks/search?${params}`),
  getPark: (parkId: string, viewerDogId?: string) => {
    const params = new URLSearchParams({ source: "google" });
    if (viewerDogId) params.set("viewerDogId", viewerDogId);
    return request<ParkType & { reviews?: Review[]; todayVisits?: Visit[]; upcomingVisits?: Visit[] }>(`/api/parks/${encodeURIComponent(parkId)}?${params}`);
  },
  suggestParkEdit: (parkId: string, body: { summary: string; suggestedData?: Record<string, unknown> }) =>
    request<{ id: string; status: string }>(`/api/parks/${encodeURIComponent(parkId)}/suggest-edit`, {
      method: "POST",
      body,
    }),
  getDogs: () => request<DogType[]>("/api/dogs"),
  uploadMedia,
  createDog: (body: Partial<DogType>) => request<DogType>("/api/dogs", { method: "POST", body }),
  deleteDog: (dogId: string) => request<void>(`/api/dogs/${dogId}`, { method: "DELETE" }),
  updateDog: (dogId: string, body: Partial<DogType>) =>
    request<DogType>(`/api/dogs/${dogId}`, { method: "PATCH", body }),
  getVisits: (parkId?: string, viewerDogId?: string) => {
    const params = new URLSearchParams();
    if (parkId) params.set("parkId", parkId);
    if (viewerDogId) params.set("viewerDogId", viewerDogId);
    const query = params.toString();
    return request<Visit[]>(query ? `/api/visits?${query}` : "/api/visits");
  },
  getMyVisits: (viewerDogId?: string) => request<Visit[]>(viewerDogId ? `/api/visits?mine=true&viewerDogId=${encodeURIComponent(viewerDogId)}` : "/api/visits?mine=true"),
  createVisit: (body: { parkId: string; dogId?: string; startsAt: string; durationMinutes: number; notes?: string; socialIntent?: string }) =>
    request<{ id: string; status: string }>("/api/visits", { method: "POST", body }),
  updateVisit: (
    visitId: string,
    body: { dogId?: string; startsAt?: string; durationMinutes?: number; notes?: string; socialIntent?: string; status?: string },
  ) => request<{ id: string }>(`/api/visits/${visitId}`, { method: "PATCH", body }),
  checkIn: (visitId: string) => request<{ id: string; status: string }>(`/api/visits/${visitId}/check-in`, { method: "POST" }),
  followUser: (userId: string | number) => request<void>("/api/follows", { method: "POST", body: { userId } }),
  getBlocks: () => request<UserBrief[]>("/api/blocks"),
  blockUser: (body: { userId?: string | number; visitId?: string }) =>
    request<{ blockedUserId: string | number }>("/api/blocks", { method: "POST", body }),
  unblockUser: (userId: string | number) => request<void>(`/api/blocks/${userId}`, { method: "DELETE" }),
  getFriends: () => request<FriendsResponse>("/api/friends"),
  sendFriendRequest: (body: { userId?: string | number; visitId?: string }) =>
    request<{ id: string; status: string }>("/api/friends/requests", { method: "POST", body }),
  acceptFriendRequest: (id: string) =>
    request<{ id: string; status: string }>(`/api/friends/requests/${id}/accept`, { method: "POST" }),
  declineFriendRequest: (id: string) =>
    request<{ id: string; status: string }>(`/api/friends/requests/${id}/decline`, { method: "POST" }),
  removeFriend: (userId: string | number) => request<void>(`/api/friends/${userId}`, { method: "DELETE" }),
  getConversations: () => request<Conversation[]>("/api/conversations"),
  createConversation: (visitId: string) =>
    request<{ id: string }>("/api/conversations", { method: "POST", body: { visitId } }),
  getMessages: (conversationId: string) => request<DirectMessage[]>(`/api/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: string, body: string) =>
    request<DirectMessage>(`/api/conversations/${conversationId}/messages`, { method: "POST", body: { body } }),
  interestVisit: (visitId: string) =>
    request<{ id: string; interested: boolean; interestCount: number }>(`/api/visits/${visitId}/interest`, { method: "POST" }),
  uninterestVisit: (visitId: string) =>
    request<{ id: string; interested: boolean; interestCount: number }>(`/api/visits/${visitId}/interest`, { method: "DELETE" }),
  getReviews: (parkId?: string) =>
    request<Review[]>(parkId ? `/api/reviews?parkId=${encodeURIComponent(parkId)}` : "/api/reviews"),
  createReview: (body: { parkId: string; rating: number; title?: string; body: string }) =>
    request<{ id: string; status: string }>("/api/reviews", { method: "POST", body }),
  report: (body: { targetType: string; targetId: string; reason: string; details?: string }) =>
    request<{ id: string; status: string }>("/api/reports", { method: "POST", body }),
  getReports: () => request<Report[]>("/api/admin/reports"),
  updateReport: (id: string, body: { status: string; moderatorNotes?: string }) =>
    request<{ id: string }>(`/api/admin/reports/${id}`, { method: "PATCH", body }),
};
