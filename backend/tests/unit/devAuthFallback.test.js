const assert = require('node:assert/strict');
const test = require('node:test');
const {
  acceptDevFriendRequest,
  blockDevUser,
  canUseDevAuthFallback,
  createDevConversationFromVisit,
  createDevPasswordUser,
  createDevDog,
  createDevGoogleUser,
  findDevPasswordUserByEmail,
  findDevPasswordUserByUsername,
  createDevVisit,
  isDatabaseConnectionError,
  isDevAuthUserId,
  listDevConversations,
  listDevFriends,
  listDevVisits,
  publicDevUser,
  sendDevFriendRequest,
  sendDevMessage,
  setDevVisitInterest,
} = require('../../devAuthFallback');

test('detects database connection errors for local OAuth fallback', (t) => {
  const originalFallback = process.env.AUTH_DB_FALLBACK;
  process.env.AUTH_DB_FALLBACK = 'true';
  t.after(() => {
    if (originalFallback === undefined) {
      delete process.env.AUTH_DB_FALLBACK;
    } else {
      process.env.AUTH_DB_FALLBACK = originalFallback;
    }
  });

  assert.equal(isDatabaseConnectionError({ code: 'ETIMEDOUT' }), true);
  assert.equal(canUseDevAuthFallback({ code: 'ETIMEDOUT' }), true);
  assert.equal(isDatabaseConnectionError({ code: 'ER_DUP_ENTRY' }), false);
});

test('creates deterministic development Google users from a Google profile', () => {
  const profile = {
    sub: 'google-sub-123',
    email: 'Owner.Example@example.com',
    name: 'Owner Example',
    picture: 'https://example.com/avatar.png',
  };

  const first = createDevGoogleUser(profile);
  const second = createDevGoogleUser(profile);

  assert.equal(first.id, second.id);
  assert.equal(isDevAuthUserId(first.id), true);
  assert.equal(first.email, profile.email);
  assert.equal(first.full_name, 'Owner Example');
  assert.equal(first.username, 'owner_example');
  assert.equal(first.devAuthFallback, true);
});

test('maps development session users to the public user contract', () => {
  const publicUser = publicDevUser({
    id: 'dev-google-abc',
    email: 'owner@example.com',
    username: 'owner',
    role: 'member',
    fullName: 'Owner Example',
    avatarUrl: 'https://example.com/avatar.png',
  });

  assert.equal(publicUser.id, 'dev-google-abc');
  assert.equal(publicUser.fullName, 'Owner Example');
  assert.equal(publicUser.human_name, 'Owner Example');
  assert.equal(publicUser.avatarUrl, 'https://example.com/avatar.png');
  assert.equal(publicUser.developmentOnly, true);
});

test('development password users can be found by email and username', () => {
  const user = createDevPasswordUser({
    fullName: 'Email Owner',
    email: 'Email.Owner@example.com',
    username: 'email_owner',
    passwordHash: 'hashed-password',
  });

  assert.equal(user.id.startsWith('dev-email-'), true);
  assert.equal(findDevPasswordUserByEmail('email.owner@example.com').id, user.id);
  assert.equal(findDevPasswordUserByUsername('email_owner').email, 'email.owner@example.com');
});

test('development visits include duration, social intent, dog details, and interest counts', () => {
  const owner = {
    id: 'dev-google-owner',
    email: 'owner@example.com',
    username: 'owner',
    fullName: 'Owner Example',
  };
  const interestedUser = {
    id: 'dev-google-friend',
    email: 'friend@example.com',
    username: 'friend',
    fullName: 'Friend Example',
  };
  const dog = createDevDog(owner.id, {
    name: 'Maple',
    size: 'medium',
    breed: 'Retriever mix',
    avatarUrl: 'https://example.com/maple.png',
    energyLevel: 'high',
    playStyle: 'balanced',
    socialComfort: 'social',
    preferredDogSizes: ['medium', 'large'],
  });
  assert.equal(dog.energyLevel, 'high');
  assert.deepEqual(dog.preferredDogSizes, ['medium', 'large']);
  const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const visit = createDevVisit(owner, {
    parkId: 'park-123',
    dogId: dog.id,
    startsAt,
    durationMinutes: 90,
    notes: 'Near the shaded benches.',
    socialIntent: 'Open to play',
  });

  assert.equal(visit.duration_minutes, 90);
  assert.equal(visit.social_intent, 'Open to play');
  assert.equal(visit.dog_name, 'Maple');
  assert.equal(visit.dog_avatar_url, 'https://example.com/maple.png');

  const interestedVisit = setDevVisitInterest(interestedUser, visit.id, true);
  assert.equal(interestedVisit.interest_count, 1);
  assert.equal(listDevVisits({ ownerId: owner.id, parkId: 'park-123', todayOnly: true }).length, 1);
});

test('development conversations require same-day same-park visits only to start', () => {
  const owner = createDevPasswordUser({
    fullName: 'Conversation Owner',
    email: 'conversation-owner@example.com',
    username: 'conversation_owner',
    passwordHash: 'hash',
  });
  const friend = createDevPasswordUser({
    fullName: 'Conversation Friend',
    email: 'conversation-friend@example.com',
    username: 'conversation_friend',
    passwordHash: 'hash',
  });
  const ownerVisit = createDevVisit(owner, {
    parkId: 'shared-park',
    startsAt: '2099-05-08T10:00:00.000Z',
  });

  assert.equal(createDevConversationFromVisit(friend, ownerVisit.id), null);

  createDevVisit(friend, {
    parkId: 'shared-park',
    startsAt: '2099-05-08T18:00:00.000Z',
  });
  const conversation = createDevConversationFromVisit(friend, ownerVisit.id);
  assert.ok(conversation.id);

  const sent = sendDevMessage(friend, conversation.id, 'See you at the park.');
  assert.equal(sent.body, 'See you at the park.');
  assert.equal(listDevConversations(owner.id).length, 1);
});

test('development friend requests require approval and blocks remove access', () => {
  const requester = createDevPasswordUser({
    fullName: 'Friend Requester',
    email: 'friendship-requester@example.com',
    username: 'friendship_requester',
    passwordHash: 'hash',
  });
  const addressee = createDevPasswordUser({
    fullName: 'Friend Addressee',
    email: 'friendship-addressee@example.com',
    username: 'friendship_addressee',
    passwordHash: 'hash',
  });

  const request = sendDevFriendRequest(requester, { userId: addressee.id });
  assert.equal(request.status, 'pending');
  assert.equal(listDevFriends(addressee.id).incomingRequests.length, 1);

  const accepted = acceptDevFriendRequest(addressee.id, request.id, true);
  assert.equal(accepted.status, 'accepted');
  assert.equal(listDevFriends(requester.id).friends.length, 1);

  blockDevUser(addressee.id, { userId: requester.id });
  assert.equal(listDevFriends(requester.id).friends.length, 0);
  assert.equal(sendDevFriendRequest(requester, { userId: addressee.id }), null);
});
