const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { mapDogTraits, normalizeDogTraits } = require('./dogTraits');

const DB_CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
]);
const devDogs = new Map();
const devVisits = new Map();
const devFollows = new Set();
const devNotifications = [];
const devVisitInterests = new Set();
const devBlocks = new Set();
const devFriendships = new Map();
const devConversations = new Map();
const devDirectMessages = [];
const devPasswordUsersByEmail = new Map();
const devPasswordUsersByUsername = new Map();
const devUsersById = new Map();
const isNodeTestProcess = process.argv.some((argument) => argument.endsWith('.test.js') || argument.includes(`${path.sep}tests${path.sep}`));
const devStatePath =
  process.env.DEV_AUTH_FALLBACK_STORE ||
  (process.env.NODE_ENV === 'test' || isNodeTestProcess ? '' : path.join(__dirname, '.dev-auth-fallback.json'));

function serializeMap(map) {
  return [...map.entries()];
}

function serializeSet(set) {
  return [...set.values()];
}

function restoreMap(map, entries = []) {
  map.clear();
  for (const [key, value] of entries) map.set(key, value);
}

function restoreSet(set, values = []) {
  set.clear();
  for (const value of values) set.add(value);
}

function indexDevUser(user) {
  if (!user?.id) return user;
  devUsersById.set(String(user.id), user);
  if (user.email) devPasswordUsersByEmail.set(normalizeEmail(user.email), user);
  if (user.username) devPasswordUsersByUsername.set(normalizeUsername(user.username), user);
  return user;
}

function loadDevState() {
  if (!devStatePath || !fs.existsSync(devStatePath)) return;
  try {
    const state = JSON.parse(fs.readFileSync(devStatePath, 'utf8'));
    restoreMap(devDogs, state.devDogs);
    restoreMap(devVisits, state.devVisits);
    restoreSet(devFollows, state.devFollows);
    restoreSet(devVisitInterests, state.devVisitInterests);
    restoreSet(devBlocks, state.devBlocks);
    restoreMap(devFriendships, state.devFriendships);
    restoreMap(devConversations, state.devConversations);
    devNotifications.splice(0, devNotifications.length, ...(state.devNotifications || []));
    devDirectMessages.splice(0, devDirectMessages.length, ...(state.devDirectMessages || []));
    restoreMap(devUsersById, state.devUsersById);
    devPasswordUsersByEmail.clear();
    devPasswordUsersByUsername.clear();
    for (const user of devUsersById.values()) indexDevUser(user);
  } catch (error) {
    console.warn('Development auth fallback state could not be loaded; starting with an empty fallback store', {
      path: devStatePath,
      error: error.message,
    });
  }
}

function persistDevState() {
  if (!devStatePath) return;
  try {
    fs.mkdirSync(path.dirname(devStatePath), { recursive: true });
    fs.writeFileSync(
      devStatePath,
      JSON.stringify(
        {
          version: 1,
          devDogs: serializeMap(devDogs),
          devVisits: serializeMap(devVisits),
          devFollows: serializeSet(devFollows),
          devNotifications,
          devVisitInterests: serializeSet(devVisitInterests),
          devBlocks: serializeSet(devBlocks),
          devFriendships: serializeMap(devFriendships),
          devConversations: serializeMap(devConversations),
          devDirectMessages,
          devUsersById: serializeMap(devUsersById),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.warn('Development auth fallback state could not be saved', {
      path: devStatePath,
      error: error.message,
    });
  }
}

function isDevAuthFallbackEnabled() {
  if (process.env.AUTH_DB_FALLBACK === 'true') return true;
  if (process.env.AUTH_DB_FALLBACK === 'false') return false;
  return config.nodeEnv !== 'production';
}

function isDatabaseConnectionError(error) {
  return Boolean(error && DB_CONNECTION_ERROR_CODES.has(error.code));
}

function canUseDevAuthFallback(error) {
  return isDevAuthFallbackEnabled() && isDatabaseConnectionError(error);
}

function normalizeUsername(value) {
  const normalized = String(value || 'google-user')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return normalized || 'google-user';
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function createDevGoogleUser(profile) {
  const seed = profile.sub || profile.email || crypto.randomUUID();
  const id = `dev-google-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16)}`;
  const existing = devUsersById.get(id);
  if (existing) return existing;

  const emailPrefix = profile.email?.split('@')[0];
  const fullName = profile.name || profile.email || 'Google User';

  const user = {
    id,
    full_name: fullName,
    fullName,
    email: profile.email,
    username: normalizeUsername(profile.name || emailPrefix),
    role: 'member',
    avatar_url: profile.picture || '',
    avatarUrl: profile.picture || '',
    google_sub: profile.sub,
    devAuthFallback: true,
  };
  indexDevUser(user);
  persistDevState();
  return user;
}

function isDevAuthUserId(userId) {
  return String(userId || '').startsWith('dev-');
}

function createDevPasswordUser({ fullName, email, username, passwordHash }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeUsername(username || normalizedEmail.split('@')[0]);
  const id = `dev-email-${crypto.createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 16)}`;
  const existing = devUsersById.get(id);
  if (existing) return existing;

  const user = {
    id,
    full_name: fullName || normalizedUsername,
    fullName: fullName || normalizedUsername,
    email: normalizedEmail,
    username: normalizedUsername,
    password_hash: passwordHash,
    role: 'member',
    avatar_url: '',
    avatarUrl: '',
    bio: '',
    homeCity: '',
    messagesEnabled: true,
    activityVisibility: 'owner_and_dog',
    notificationPreferences: null,
    devAuthFallback: true,
  };
  indexDevUser(user);
  persistDevState();
  return user;
}

function findDevPasswordUserByEmail(email) {
  return devPasswordUsersByEmail.get(normalizeEmail(email)) || null;
}

function findDevPasswordUserByUsername(username) {
  return devPasswordUsersByUsername.get(normalizeUsername(username)) || null;
}

function clearDevPasswordUsersByEmailPrefix(prefix) {
  const normalizedPrefix = String(prefix || '').toLowerCase();
  const removedUserIds = [];
  for (const [email, user] of devPasswordUsersByEmail.entries()) {
    if (!email.startsWith(normalizedPrefix)) continue;
    removedUserIds.push(user.id);
    devPasswordUsersByEmail.delete(email);
    devPasswordUsersByUsername.delete(user.username);
    devUsersById.delete(String(user.id));
  }
  for (const [dogId, dog] of devDogs.entries()) {
    if (removedUserIds.includes(dog.owner_id)) devDogs.delete(dogId);
  }
  for (const [visitId, visit] of devVisits.entries()) {
    if (removedUserIds.includes(visit.user_id)) devVisits.delete(visitId);
  }
  for (const key of [...devVisitInterests]) {
    const [, userId] = key.split(':');
    if (removedUserIds.includes(userId)) devVisitInterests.delete(key);
  }
  persistDevState();
  return removedUserIds.length;
}

function publicDevUser(sessionUser, overrides = {}) {
  const storedUser = devUsersById.get(String(sessionUser.id)) || {};
  const fullName =
    overrides.fullName ||
    overrides.human_name ||
    storedUser.fullName ||
    storedUser.full_name ||
    sessionUser.fullName ||
    sessionUser.username ||
    '';
  const username = overrides.username || storedUser.username || sessionUser.username || normalizeUsername(fullName || sessionUser.email);

  return {
    id: sessionUser.id,
    fullName,
    human_name: fullName,
    email: storedUser.email || sessionUser.email,
    username,
    role: storedUser.role || sessionUser.role || 'member',
    bio: overrides.bio ?? storedUser.bio ?? '',
    homeCity: overrides.homeCity ?? storedUser.homeCity ?? '',
    avatarUrl: overrides.avatarUrl ?? storedUser.avatarUrl ?? storedUser.avatar_url ?? sessionUser.avatarUrl ?? '',
    messagesEnabled: overrides.messagesEnabled ?? storedUser.messagesEnabled ?? true,
    activityVisibility: overrides.activityVisibility || storedUser.activityVisibility || 'owner_and_dog',
    notificationPreferences: overrides.notificationPreferences ?? storedUser.notificationPreferences ?? null,
    createdAt: null,
    developmentOnly: true,
  };
}

function updateDevUser(userId, overrides = {}) {
  const current = devUsersById.get(String(userId));
  if (!current) return null;
  const next = {
    ...current,
    fullName: overrides.fullName || overrides.human_name || current.fullName || current.full_name,
    full_name: overrides.fullName || overrides.human_name || current.full_name || current.fullName,
    username: overrides.username || current.username,
    bio: overrides.bio ?? current.bio ?? '',
    homeCity: overrides.homeCity ?? current.homeCity ?? '',
    avatarUrl: overrides.avatarUrl ?? current.avatarUrl ?? current.avatar_url ?? '',
    avatar_url: overrides.avatarUrl ?? current.avatar_url ?? current.avatarUrl ?? '',
    messagesEnabled: overrides.messagesEnabled ?? current.messagesEnabled ?? true,
    activityVisibility: overrides.activityVisibility || current.activityVisibility || 'owner_and_dog',
    notificationPreferences: overrides.notificationPreferences ?? current.notificationPreferences ?? null,
  };
  indexDevUser(next);
  persistDevState();
  return publicDevUser(next);
}

function mapDevDog(dog) {
  return {
    id: dog.id,
    ownerId: dog.owner_id,
    dog_name: dog.name,
    name: dog.name,
    size: dog.size,
    breed: dog.breed || '',
    breedKey: dog.breed_key || '',
    avatarUrl: dog.avatar_url || '',
    ...mapDogTraits(dog),
    isFriendly: Boolean(dog.is_friendly),
    isPuppy: Boolean(dog.is_puppy),
    isPublic: Boolean(dog.is_public),
    notes: dog.notes || '',
    createdAt: dog.created_at,
  };
}

function listDevDogs(ownerId, publicOnly = false) {
  return [...devDogs.values()]
    .filter((dog) => dog.owner_id === ownerId && !dog.deleted_at && (!publicOnly || dog.is_public))
    .sort((first, second) => String(second.created_at).localeCompare(String(first.created_at)))
    .map(mapDevDog);
}

function createDevDog(ownerId, body) {
  const now = new Date().toISOString();
  const dogName = body.name || body.dog_name;
  const traits = normalizeDogTraits(body);
  const dog = {
    id: crypto.randomUUID(),
    owner_id: ownerId,
    name: dogName,
    size: body.size,
    breed: body.breed || '',
    breed_key: body.breedKey || body.breed_key || '',
    avatar_url: body.avatarUrl || '',
    energy_level: traits.energyLevel,
    play_style: traits.playStyle,
    social_comfort: traits.socialComfort,
    preferred_dog_sizes: traits.preferredDogSizes,
    is_friendly: body.isFriendly ?? body.is_friendly ?? true,
    is_puppy: body.isPuppy ?? body.is_puppy ?? false,
    is_public: body.isPublic ?? true,
    notes: body.notes || '',
    created_at: now,
    updated_at: now,
  };
  devDogs.set(dog.id, dog);
  persistDevState();
  return mapDevDog(dog);
}

function updateDevDog(ownerId, dogId, body) {
  const dog = devDogs.get(dogId);
  if (!dog || dog.owner_id !== ownerId || dog.deleted_at) return null;
  const traits = normalizeDogTraits(body, { partial: true });

  dog.name = body.name || body.dog_name || dog.name;
  dog.size = body.size || dog.size;
  dog.breed = body.breed ?? dog.breed;
  dog.breed_key = body.breedKey ?? body.breed_key ?? dog.breed_key;
  dog.avatar_url = body.avatarUrl ?? dog.avatar_url;
  dog.energy_level = traits.energyLevel || dog.energy_level || 'moderate';
  dog.play_style = traits.playStyle || dog.play_style || 'balanced';
  dog.social_comfort = traits.socialComfort || dog.social_comfort || 'social';
  dog.preferred_dog_sizes = traits.preferredDogSizes === undefined ? dog.preferred_dog_sizes || [] : traits.preferredDogSizes;
  dog.is_friendly = body.isFriendly === undefined ? dog.is_friendly : body.isFriendly;
  dog.is_puppy = body.isPuppy === undefined ? dog.is_puppy : body.isPuppy;
  dog.is_public = body.isPublic === undefined ? dog.is_public : body.isPublic;
  dog.notes = body.notes ?? dog.notes;
  dog.updated_at = new Date().toISOString();
  devDogs.set(dog.id, dog);
  persistDevState();
  return mapDevDog(dog);
}

function deleteDevDog(ownerId, dogId) {
  const dog = devDogs.get(dogId);
  if (!dog || dog.owner_id !== ownerId || dog.deleted_at) return false;
  dog.deleted_at = new Date().toISOString();
  persistDevState();
  return true;
}

function mapDevVisit(visit) {
  const dog = visit.dog_id ? devDogs.get(visit.dog_id) : null;
  const interestPrefix = `${visit.id}:`;
  const interestedUserIds = [...devVisitInterests]
    .filter((key) => key.startsWith(interestPrefix))
    .map((key) => key.slice(interestPrefix.length));
  return {
    id: visit.id,
    owner_user_id: visit.user_id,
    park_ref: visit.park_ref,
    starts_at: visit.starts_at,
    duration_minutes: visit.duration_minutes,
    status: visit.status,
    notes: visit.notes || '',
    social_intent: visit.social_intent || '',
    username: visit.username,
    full_name: visit.full_name,
    dog_id: dog && !dog.deleted_at ? dog.id : '',
    dog_name: dog && !dog.deleted_at && dog.is_public ? dog.name : '',
    dog_size: dog && !dog.deleted_at && dog.is_public ? dog.size : '',
    dog_breed: dog && !dog.deleted_at && dog.is_public ? dog.breed : '',
    dog_breed_key: dog && !dog.deleted_at && dog.is_public ? dog.breed_key : '',
    dog_avatar_url: dog && !dog.deleted_at && dog.is_public ? dog.avatar_url : '',
    dog_energy_level: dog && !dog.deleted_at && dog.is_public ? dog.energy_level || 'moderate' : '',
    dog_play_style: dog && !dog.deleted_at && dog.is_public ? dog.play_style || 'balanced' : '',
    dog_social_comfort: dog && !dog.deleted_at && dog.is_public ? dog.social_comfort || 'social' : '',
    dog_preferred_sizes: dog && !dog.deleted_at && dog.is_public ? dog.preferred_dog_sizes || [] : [],
    interest_count: interestedUserIds.length,
    interested_user_ids: interestedUserIds,
  };
}

function listDevVisits({ ownerId, parkId, mineOnly = false, todayOnly = false } = {}) {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  return [...devVisits.values()]
    .filter((visit) => visit.status !== 'cancelled')
    .filter((visit) => !parkId || visit.park_ref === parkId)
    .filter((visit) => !mineOnly || visit.user_id === ownerId)
    .filter((visit) => todayOnly || Number.isNaN(Date.parse(visit.starts_at)) || Date.parse(visit.starts_at) >= now)
    .filter((visit) => {
      if (!todayOnly) return true;
      const visitTime = Date.parse(visit.starts_at);
      return !Number.isNaN(visitTime) && visitTime >= startOfToday.getTime() && visitTime < startOfTomorrow.getTime();
    })
    .sort((first, second) => String(first.starts_at).localeCompare(String(second.starts_at)))
    .map(mapDevVisit);
}

function createDevVisit(user, body) {
  if (body.dogId) {
    const dog = devDogs.get(body.dogId);
    if (!dog || dog.owner_id !== user.id || dog.deleted_at) return null;
  }

  const now = new Date().toISOString();
  const visit = {
    id: crypto.randomUUID(),
    user_id: user.id,
    username: user.username,
    full_name: user.fullName || user.username,
    park_ref: body.parkId,
    dog_id: body.dogId || '',
    starts_at: body.startsAt,
    duration_minutes: Number(body.durationMinutes || 60),
    notes: body.notes || '',
    social_intent: body.socialIntent || body.social_intent || '',
    status: 'planned',
    created_at: now,
    updated_at: now,
  };
  devVisits.set(visit.id, visit);
  notifyDevFriendsOfVisit(user, visit);
  persistDevState();
  return mapDevVisit(visit);
}

function updateDevVisit(user, visitId, body) {
  const visit = devVisits.get(visitId);
  if (!visit || visit.user_id !== user.id) return null;
  if (body.dogId) {
    const dog = devDogs.get(body.dogId);
    if (!dog || dog.owner_id !== user.id || dog.deleted_at) return null;
  }
  visit.starts_at = body.startsAt || visit.starts_at;
  visit.duration_minutes = body.durationMinutes || visit.duration_minutes;
  visit.notes = body.notes ?? visit.notes;
  visit.social_intent = body.socialIntent ?? body.social_intent ?? visit.social_intent;
  visit.status = body.status || visit.status;
  visit.dog_id = body.dogId === undefined ? visit.dog_id : body.dogId;
  visit.updated_at = new Date().toISOString();
  devVisits.set(visit.id, visit);
  persistDevState();
  return mapDevVisit(visit);
}

function createDevNotification(userId, type, title, body) {
  const notification = {
    id: crypto.randomUUID(),
    user_id: userId,
    type,
    title,
    body,
    read_at: null,
    created_at: new Date().toISOString(),
  };
  devNotifications.unshift(notification);
  persistDevState();
  return notification;
}

function followDevUser(followerId, followedId) {
  if (!followedId || followerId === followedId) return false;
  const key = `${followerId}:${followedId}`;
  const alreadyFollowing = devFollows.has(key);
  devFollows.add(key);
  if (!alreadyFollowing) {
    createDevNotification(followedId, 'owner_follow', 'New follower', 'Another owner followed your dog park plans.');
  }
  persistDevState();
  return true;
}

function unfollowDevUser(followerId, followedId) {
  const deleted = devFollows.delete(`${followerId}:${followedId}`);
  if (deleted) persistDevState();
  return deleted;
}

function listDevNotifications(userId) {
  return devNotifications.filter((notification) => notification.user_id === userId);
}

function setDevVisitInterest(user, visitId, interested) {
  const visit = devVisits.get(visitId);
  if (!visit || visit.user_id === user.id) return null;
  const key = `${visitId}:${user.id}`;
  const hadInterest = devVisitInterests.has(key);
  if (interested) {
    devVisitInterests.add(key);
    if (!hadInterest) {
      createDevNotification(
        visit.user_id,
        'visit_interest',
        'Someone is interested in your visit',
        `${user.username || 'Another owner'} is interested in your dog park plan.`,
      );
    }
  } else {
    devVisitInterests.delete(key);
  }
  persistDevState();
  return mapDevVisit(visit);
}

function devBlockKey(blockerId, blockedId) {
  return `${blockerId}:${blockedId}`;
}

function devPairKey(firstUserId, secondUserId) {
  return [String(firstUserId), String(secondUserId)].sort().join(':');
}

function getDevUserBrief(userId) {
  const id = String(userId || '');
  for (const user of devPasswordUsersByEmail.values()) {
    if (String(user.id) === id) {
      return {
        id: user.id,
        username: user.username,
        fullName: user.fullName || user.full_name || user.username,
        avatarUrl: user.avatar_url || user.avatarUrl || '',
      };
    }
  }
  for (const visit of devVisits.values()) {
    if (String(visit.user_id) === id) {
      return {
        id: visit.user_id,
        username: visit.username || 'owner',
        fullName: visit.full_name || visit.username || 'Owner',
        avatarUrl: '',
      };
    }
  }
  return { id, username: 'owner', fullName: 'Owner', avatarUrl: '' };
}

function resolveDevTargetUserId(body) {
  if (body.userId) return String(body.userId);
  if (!body.visitId) return '';
  const visit = devVisits.get(body.visitId);
  return visit ? String(visit.user_id) : '';
}

function isDevBlocked(firstUserId, secondUserId) {
  return devBlocks.has(devBlockKey(firstUserId, secondUserId)) || devBlocks.has(devBlockKey(secondUserId, firstUserId));
}

function blockDevUser(blockerId, body) {
  const blockedId = resolveDevTargetUserId(body);
  if (!blockedId || String(blockerId) === String(blockedId)) return null;
  devBlocks.add(devBlockKey(blockerId, blockedId));
  for (const [id, friendship] of devFriendships.entries()) {
    if (
      (String(friendship.requester_user_id) === String(blockerId) && String(friendship.addressee_user_id) === String(blockedId)) ||
      (String(friendship.requester_user_id) === String(blockedId) && String(friendship.addressee_user_id) === String(blockerId))
    ) {
      devFriendships.delete(id);
    }
  }
  devFollows.delete(devBlockKey(blockerId, blockedId));
  devFollows.delete(devBlockKey(blockedId, blockerId));
  persistDevState();
  return { blockedUserId: blockedId };
}

function unblockDevUser(blockerId, blockedId) {
  const deleted = devBlocks.delete(devBlockKey(blockerId, blockedId));
  if (deleted) persistDevState();
  return deleted;
}

function listDevBlocks(userId) {
  return [...devBlocks]
    .filter((key) => key.startsWith(`${userId}:`))
    .map((key) => {
      const blockedId = key.slice(String(userId).length + 1);
      return { ...getDevUserBrief(blockedId), createdAt: null };
    });
}

function mapDevFriendship(friendship, currentUserId) {
  const otherUserId =
    String(friendship.requester_user_id) === String(currentUserId)
      ? friendship.addressee_user_id
      : friendship.requester_user_id;
  return {
    id: friendship.id,
    status: friendship.status,
    user: getDevUserBrief(otherUserId),
    createdAt: friendship.created_at,
  };
}

function listDevFriends(userId) {
  const payload = { friends: [], incomingRequests: [], outgoingRequests: [] };
  for (const friendship of devFriendships.values()) {
    const participates =
      String(friendship.requester_user_id) === String(userId) || String(friendship.addressee_user_id) === String(userId);
    if (!participates || isDevBlocked(friendship.requester_user_id, friendship.addressee_user_id)) continue;
    const item = mapDevFriendship(friendship, userId);
    if (friendship.status === 'accepted') payload.friends.push(item);
    if (friendship.status === 'pending' && String(friendship.addressee_user_id) === String(userId)) payload.incomingRequests.push(item);
    if (friendship.status === 'pending' && String(friendship.requester_user_id) === String(userId)) payload.outgoingRequests.push(item);
  }
  return payload;
}

function findDevFriendship(firstUserId, secondUserId) {
  for (const friendship of devFriendships.values()) {
    if (
      (String(friendship.requester_user_id) === String(firstUserId) && String(friendship.addressee_user_id) === String(secondUserId)) ||
      (String(friendship.requester_user_id) === String(secondUserId) && String(friendship.addressee_user_id) === String(firstUserId))
    ) {
      return friendship;
    }
  }
  return null;
}

function sendDevFriendRequest(user, body) {
  const targetUserId = resolveDevTargetUserId(body);
  if (!targetUserId || String(targetUserId) === String(user.id) || isDevBlocked(user.id, targetUserId)) return null;
  const existing = findDevFriendship(user.id, targetUserId);
  if (existing) {
    if (existing.status === 'declined') {
      existing.requester_user_id = user.id;
      existing.addressee_user_id = targetUserId;
      existing.status = 'pending';
      existing.responded_at = null;
    }
    persistDevState();
    return { id: existing.id, status: existing.status };
  }
  const friendship = {
    id: crypto.randomUUID(),
    requester_user_id: user.id,
    addressee_user_id: targetUserId,
    status: 'pending',
    created_at: new Date().toISOString(),
    responded_at: null,
  };
  devFriendships.set(friendship.id, friendship);
  createDevNotification(targetUserId, 'friend_request', 'New friend request', `${user.username || 'Another owner'} wants to become dog park friends.`);
  persistDevState();
  return { id: friendship.id, status: friendship.status };
}

function acceptDevFriendRequest(userId, friendshipId, accepted) {
  const friendship = devFriendships.get(friendshipId);
  if (!friendship || String(friendship.addressee_user_id) !== String(userId) || friendship.status !== 'pending') {
    return { id: friendshipId, status: 'not_found' };
  }
  friendship.status = accepted ? 'accepted' : 'declined';
  friendship.responded_at = new Date().toISOString();
  persistDevState();
  return { id: friendship.id, status: friendship.status };
}

function removeDevFriend(userId, otherUserId) {
  const friendship = findDevFriendship(userId, otherUserId);
  if (!friendship) return false;
  devFriendships.delete(friendship.id);
  persistDevState();
  return true;
}

function findDevConversation(firstUserId, secondUserId) {
  const pairKey = devPairKey(firstUserId, secondUserId);
  return [...devConversations.values()].find((conversation) => conversation.pair_key === pairKey) || null;
}

function hasSameDayDevVisit(userId, targetVisit) {
  const targetDay = String(targetVisit.starts_at || '').slice(0, 10);
  return [...devVisits.values()].some(
    (visit) =>
      String(visit.user_id) === String(userId) &&
      visit.status !== 'cancelled' &&
      visit.park_ref === targetVisit.park_ref &&
      String(visit.starts_at || '').slice(0, 10) === targetDay,
  );
}

function createDevConversationFromVisit(user, visitId) {
  const visit = devVisits.get(visitId);
  if (!visit || visit.status === 'cancelled' || String(visit.user_id) === String(user.id)) return null;
  if (isDevBlocked(user.id, visit.user_id)) return null;
  const existing = findDevConversation(user.id, visit.user_id);
  if (existing) return { id: existing.id };
  if (!hasSameDayDevVisit(user.id, visit)) return null;
  const conversation = {
    id: crypto.randomUUID(),
    user_one_id: String(user.id) < String(visit.user_id) ? user.id : visit.user_id,
    user_two_id: String(user.id) < String(visit.user_id) ? visit.user_id : user.id,
    pair_key: devPairKey(user.id, visit.user_id),
    created_from_visit_id: visit.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  devConversations.set(conversation.id, conversation);
  persistDevState();
  return { id: conversation.id };
}

function listDevConversations(userId) {
  return [...devConversations.values()]
    .filter((conversation) => String(conversation.user_one_id) === String(userId) || String(conversation.user_two_id) === String(userId))
    .filter((conversation) => !isDevBlocked(conversation.user_one_id, conversation.user_two_id))
    .map((conversation) => {
      const otherUserId = String(conversation.user_one_id) === String(userId) ? conversation.user_two_id : conversation.user_one_id;
      const messages = devDirectMessages.filter((message) => message.conversation_id === conversation.id);
      const latest = messages[messages.length - 1];
      return {
        id: conversation.id,
        otherUser: getDevUserBrief(otherUserId),
        latestBody: latest?.body || '',
        latestAt: latest?.created_at || conversation.updated_at,
        createdAt: conversation.created_at,
      };
    })
    .sort((first, second) => String(second.latestAt).localeCompare(String(first.latestAt)));
}

function listDevMessages(userId, conversationId) {
  const conversation = devConversations.get(conversationId);
  if (!conversation) return [];
  const participates = String(conversation.user_one_id) === String(userId) || String(conversation.user_two_id) === String(userId);
  if (!participates || isDevBlocked(conversation.user_one_id, conversation.user_two_id)) return [];
  return devDirectMessages.filter((message) => message.conversation_id === conversationId);
}

function sendDevMessage(user, conversationId, body) {
  const conversation = devConversations.get(conversationId);
  if (!conversation) return null;
  const participates = String(conversation.user_one_id) === String(user.id) || String(conversation.user_two_id) === String(user.id);
  if (!participates || isDevBlocked(conversation.user_one_id, conversation.user_two_id)) return null;
  const message = {
    id: crypto.randomUUID(),
    conversation_id: conversationId,
    sender_user_id: user.id,
    body: String(body || '').slice(0, 4000),
    read_at: null,
    created_at: new Date().toISOString(),
  };
  devDirectMessages.push(message);
  conversation.updated_at = message.created_at;
  const otherUserId = String(conversation.user_one_id) === String(user.id) ? conversation.user_two_id : conversation.user_one_id;
  createDevNotification(otherUserId, 'direct_message', 'New message', `${user.username || 'Another owner'} sent you a message.`);
  persistDevState();
  return message;
}

function notifyDevFriendsOfVisit(user, visit) {
  for (const friendship of devFriendships.values()) {
    if (friendship.status !== 'accepted') continue;
    const isRequester = String(friendship.requester_user_id) === String(user.id);
    const isAddressee = String(friendship.addressee_user_id) === String(user.id);
    if (!isRequester && !isAddressee) continue;
    const friendId = isRequester ? friendship.addressee_user_id : friendship.requester_user_id;
    if (isDevBlocked(user.id, friendId)) continue;
    createDevNotification(
      friendId,
      'friend_visit',
      'Friend scheduled a park visit',
      `${user.username || 'A friend'} scheduled a visit at ${visit.park_ref}.`,
    );
  }
}

loadDevState();

module.exports = {
  acceptDevFriendRequest,
  blockDevUser,
  canUseDevAuthFallback,
  clearDevPasswordUsersByEmailPrefix,
  createDevConversationFromVisit,
  createDevGoogleUser,
  createDevDog,
  createDevNotification,
  createDevPasswordUser,
  createDevVisit,
  deleteDevDog,
  findDevPasswordUserByEmail,
  findDevPasswordUserByUsername,
  followDevUser,
  isDatabaseConnectionError,
  isDevAuthFallbackEnabled,
  isDevAuthUserId,
  listDevBlocks,
  listDevConversations,
  listDevDogs,
  listDevFriends,
  listDevMessages,
  listDevNotifications,
  listDevVisits,
  publicDevUser,
  removeDevFriend,
  sendDevFriendRequest,
  sendDevMessage,
  setDevVisitInterest,
  unfollowDevUser,
  unblockDevUser,
  updateDevDog,
  updateDevUser,
  updateDevVisit,
};
