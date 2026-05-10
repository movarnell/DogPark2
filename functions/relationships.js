const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const { requireAuth } = require('./auth');
const {
  acceptDevFriendRequest,
  blockDevUser,
  createDevConversationFromVisit,
  isDevAuthUserId,
  listDevBlocks,
  listDevConversations,
  listDevFriends,
  listDevMessages,
  removeDevFriend,
  sendDevFriendRequest,
  sendDevMessage,
  unblockDevUser,
} = require('./devAuthFallback');
const { handleRouteError, requireFields } = require('./validation');

const router = express.Router();

function sortedPair(firstUserId, secondUserId) {
  const first = String(firstUserId);
  const second = String(secondUserId);
  return first < second ? [firstUserId, secondUserId] : [secondUserId, firstUserId];
}

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name || '',
    avatarUrl: row.avatar_url || '',
  };
}

function mapConversation(row) {
  return {
    id: row.id,
    otherUser: mapUser(row),
    latestBody: row.latest_body || '',
    latestAt: row.latest_at || row.updated_at || row.created_at,
    createdAt: row.created_at,
  };
}

async function createNotification(userId, type, title, body) {
  if (!userId) return;
  await db.query(
    `INSERT INTO notifications (id, user_id, type, title, body)
     VALUES (?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), userId, type, title, body],
  );
}

async function resolveTargetUserId(body) {
  if (body.userId) return body.userId;
  if (!body.visitId) return '';
  const [visits] = await db.query('SELECT user_id FROM visits WHERE id = ? AND status != "cancelled"', [body.visitId]);
  return visits[0]?.user_id || '';
}

async function hasBlocking(firstUserId, secondUserId) {
  const [blocks] = await db.query(
    `SELECT blocker_user_id
     FROM user_blocks
     WHERE (blocker_user_id = ? AND blocked_user_id = ?)
        OR (blocker_user_id = ? AND blocked_user_id = ?)
     LIMIT 1`,
    [firstUserId, secondUserId, secondUserId, firstUserId],
  );
  return Boolean(blocks[0]);
}

async function bothUsersCanMessage(firstUserId, secondUserId) {
  const [users] = await db.query(
    `SELECT id, messages_enabled
     FROM users
     WHERE id IN (?, ?) AND deleted_at IS NULL`,
    [firstUserId, secondUserId],
  );
  return users.length === 2 && users.every((user) => user.messages_enabled !== 0);
}

async function findConversation(firstUserId, secondUserId) {
  const [userOneId, userTwoId] = sortedPair(firstUserId, secondUserId);
  const [rows] = await db.query(
    `SELECT id, user_one_id, user_two_id, created_from_visit_id, created_at, updated_at
     FROM direct_conversations
     WHERE user_one_id = ? AND user_two_id = ?
     LIMIT 1`,
    [userOneId, userTwoId],
  );
  return rows[0] || null;
}

async function ensureConversationFromVisit(currentUserId, visitId) {
  const [visits] = await db.query(
    `SELECT id, user_id, park_ref, starts_at
     FROM visits
     WHERE id = ? AND status != 'cancelled'
     LIMIT 1`,
    [visitId],
  );
  const visit = visits[0];
  if (!visit) {
    const error = new Error('Visit not found');
    error.statusCode = 404;
    throw error;
  }
  if (String(visit.user_id) === String(currentUserId)) {
    const error = new Error('Cannot message your own visit');
    error.statusCode = 400;
    throw error;
  }

  const existing = await findConversation(currentUserId, visit.user_id);
  if (existing) return existing;

  if (await hasBlocking(currentUserId, visit.user_id)) {
    const error = new Error('Messaging is not available for this owner');
    error.statusCode = 403;
    throw error;
  }
  if (!(await bothUsersCanMessage(currentUserId, visit.user_id))) {
    const error = new Error('Messaging is disabled for this conversation');
    error.statusCode = 403;
    throw error;
  }

  const [matchingVisits] = await db.query(
    `SELECT id
     FROM visits
     WHERE user_id = ?
       AND park_ref = ?
       AND status != 'cancelled'
       AND DATE(starts_at) = DATE(?)
     LIMIT 1`,
    [currentUserId, visit.park_ref, visit.starts_at],
  );
  if (!matchingVisits[0]) {
    const error = new Error('You need a same-day visit at this park before starting a message');
    error.statusCode = 403;
    throw error;
  }

  const [userOneId, userTwoId] = sortedPair(currentUserId, visit.user_id);
  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO direct_conversations (id, user_one_id, user_two_id, created_from_visit_id)
     VALUES (?, ?, ?, ?)`,
    [id, userOneId, userTwoId, visit.id],
  );
  return { id, user_one_id: userOneId, user_two_id: userTwoId, created_from_visit_id: visit.id };
}

async function getConversationForUser(conversationId, userId) {
  const [rows] = await db.query(
    `SELECT id, user_one_id, user_two_id
     FROM direct_conversations
     WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)
     LIMIT 1`,
    [conversationId, userId, userId],
  );
  const conversation = rows[0];
  if (!conversation) return null;
  const otherUserId = String(conversation.user_one_id) === String(userId) ? conversation.user_two_id : conversation.user_one_id;
  if (await hasBlocking(userId, otherUserId)) return null;
  return { ...conversation, otherUserId };
}

router.get('/blocks', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) return res.json(listDevBlocks(req.user.id));

    const [blocks] = await db.query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, b.created_at
       FROM user_blocks b
       JOIN users u ON u.id = b.blocked_user_id
       WHERE b.blocker_user_id = ?
       ORDER BY b.created_at DESC`,
      [req.user.id],
    );
    res.json(blocks.map((block) => ({ ...mapUser(block), createdAt: block.created_at })));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/blocks', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) {
      const block = blockDevUser(req.user.id, req.body);
      return block ? res.status(201).json(block) : res.status(400).json({ error: 'Cannot block this user' });
    }

    const targetUserId = await resolveTargetUserId(req.body);
    if (!targetUserId || String(targetUserId) === String(req.user.id)) {
      return res.status(400).json({ error: 'Cannot block this user' });
    }
    await db.query('INSERT IGNORE INTO user_blocks (blocker_user_id, blocked_user_id) VALUES (?, ?)', [
      req.user.id,
      targetUserId,
    ]);
    await db.query(
      `DELETE FROM follows
       WHERE (follower_user_id = ? AND followed_user_id = ?)
          OR (follower_user_id = ? AND followed_user_id = ?)`,
      [req.user.id, targetUserId, targetUserId, req.user.id],
    );
    await db.query(
      `DELETE FROM friendships
       WHERE (requester_user_id = ? AND addressee_user_id = ?)
          OR (requester_user_id = ? AND addressee_user_id = ?)`,
      [req.user.id, targetUserId, targetUserId, req.user.id],
    );
    res.status(201).json({ blockedUserId: targetUserId });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.delete('/blocks/:userId', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) {
      unblockDevUser(req.user.id, req.params.userId);
      return res.status(204).end();
    }
    await db.query('DELETE FROM user_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?', [
      req.user.id,
      req.params.userId,
    ]);
    res.status(204).end();
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get('/friends', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) return res.json(listDevFriends(req.user.id));

    const [rows] = await db.query(
      `SELECT f.id AS friendship_id, f.requester_user_id, f.addressee_user_id, f.status, f.created_at, f.responded_at,
              u.id, u.username, u.full_name, u.avatar_url
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_user_id = ? THEN f.addressee_user_id ELSE f.requester_user_id END
       LEFT JOIN user_blocks b1 ON b1.blocker_user_id = ? AND b1.blocked_user_id = u.id
       LEFT JOIN user_blocks b2 ON b2.blocker_user_id = u.id AND b2.blocked_user_id = ?
       WHERE (f.requester_user_id = ? OR f.addressee_user_id = ?)
         AND b1.blocker_user_id IS NULL
         AND b2.blocker_user_id IS NULL
       ORDER BY f.updated_at DESC`,
      [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id],
    );
    const payload = { friends: [], incomingRequests: [], outgoingRequests: [] };
    for (const row of rows) {
      const item = {
        id: row.friendship_id,
        status: row.status,
        user: mapUser(row),
        createdAt: row.created_at,
      };
      if (row.status === 'accepted') payload.friends.push(item);
      if (row.status === 'pending' && String(row.addressee_user_id) === String(req.user.id)) payload.incomingRequests.push(item);
      if (row.status === 'pending' && String(row.requester_user_id) === String(req.user.id)) payload.outgoingRequests.push(item);
    }
    res.json(payload);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/friends/requests', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) {
      const request = sendDevFriendRequest(req.user, req.body);
      return request ? res.status(201).json(request) : res.status(400).json({ error: 'Cannot request this friend' });
    }

    const targetUserId = await resolveTargetUserId(req.body);
    if (!targetUserId || String(targetUserId) === String(req.user.id)) {
      return res.status(400).json({ error: 'Cannot request this friend' });
    }
    if (await hasBlocking(req.user.id, targetUserId)) {
      return res.status(403).json({ error: 'Friend request is not available for this owner' });
    }

    const [existingRows] = await db.query(
      `SELECT *
       FROM friendships
       WHERE (requester_user_id = ? AND addressee_user_id = ?)
          OR (requester_user_id = ? AND addressee_user_id = ?)
       LIMIT 1`,
      [req.user.id, targetUserId, targetUserId, req.user.id],
    );
    const existing = existingRows[0];
    if (existing) {
      if (existing.status === 'declined') {
        await db.query(
          `UPDATE friendships
           SET requester_user_id = ?, addressee_user_id = ?, status = 'pending', responded_at = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [req.user.id, targetUserId, existing.id],
        );
      }
      return res.status(200).json({ id: existing.id, status: existing.status === 'declined' ? 'pending' : existing.status });
    }

    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO friendships (id, requester_user_id, addressee_user_id, status)
       VALUES (?, ?, ?, 'pending')`,
      [id, req.user.id, targetUserId],
    );
    await createNotification(
      targetUserId,
      'friend_request',
      'New friend request',
      `${req.user.username || 'Another owner'} wants to become dog park friends.`,
    );
    res.status(201).json({ id, status: 'pending' });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/friends/requests/:id/accept', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) return res.json(acceptDevFriendRequest(req.user.id, req.params.id, true));

    const [result] = await db.query(
      `UPDATE friendships
       SET status = 'accepted', responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND addressee_user_id = ? AND status = 'pending'`,
      [req.params.id, req.user.id],
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Friend request not found' });
    res.json({ id: req.params.id, status: 'accepted' });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/friends/requests/:id/decline', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) return res.json(acceptDevFriendRequest(req.user.id, req.params.id, false));

    const [result] = await db.query(
      `UPDATE friendships
       SET status = 'declined', responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND addressee_user_id = ? AND status = 'pending'`,
      [req.params.id, req.user.id],
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Friend request not found' });
    res.json({ id: req.params.id, status: 'declined' });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.delete('/friends/:userId', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) {
      removeDevFriend(req.user.id, req.params.userId);
      return res.status(204).end();
    }

    await db.query(
      `DELETE FROM friendships
       WHERE (requester_user_id = ? AND addressee_user_id = ?)
          OR (requester_user_id = ? AND addressee_user_id = ?)`,
      [req.user.id, req.params.userId, req.params.userId, req.user.id],
    );
    res.status(204).end();
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get('/conversations', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) return res.json(listDevConversations(req.user.id));

    const [conversations] = await db.query(
      `SELECT c.id, c.created_at, c.updated_at,
              u.id, u.username, u.full_name, u.avatar_url,
              (SELECT body FROM direct_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS latest_body,
              (SELECT created_at FROM direct_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS latest_at
       FROM direct_conversations c
       JOIN users u ON u.id = CASE WHEN c.user_one_id = ? THEN c.user_two_id ELSE c.user_one_id END
       LEFT JOIN user_blocks b1 ON b1.blocker_user_id = ? AND b1.blocked_user_id = u.id
       LEFT JOIN user_blocks b2 ON b2.blocker_user_id = u.id AND b2.blocked_user_id = ?
       WHERE (c.user_one_id = ? OR c.user_two_id = ?)
         AND u.deleted_at IS NULL
         AND b1.blocker_user_id IS NULL
         AND b2.blocker_user_id IS NULL
       ORDER BY COALESCE(latest_at, c.updated_at, c.created_at) DESC`,
      [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id],
    );
    res.json(conversations.map(mapConversation));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/conversations', requireAuth, async (req, res) => {
  try {
    requireFields(req.body, ['visitId']);
    if (isDevAuthUserId(req.user.id)) {
      const conversation = createDevConversationFromVisit(req.user, req.body.visitId);
      return conversation ? res.status(201).json(conversation) : res.status(403).json({ error: 'Conversation is not available' });
    }

    const conversation = await ensureConversationFromVisit(req.user.id, req.body.visitId);
    res.status(201).json({ id: conversation.id });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) return res.json(listDevMessages(req.user.id, req.params.id));

    const conversation = await getConversationForUser(req.params.id, req.user.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    const [messages] = await db.query(
      `SELECT id, conversation_id, sender_user_id, body, read_at, created_at
       FROM direct_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC
       LIMIT 200`,
      [req.params.id],
    );
    res.json(messages);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    requireFields(req.body, ['body']);
    if (isDevAuthUserId(req.user.id)) {
      const message = sendDevMessage(req.user, req.params.id, req.body.body);
      return message ? res.status(201).json(message) : res.status(403).json({ error: 'Message is not available' });
    }

    const conversation = await getConversationForUser(req.params.id, req.user.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!(await bothUsersCanMessage(req.user.id, conversation.otherUserId))) {
      return res.status(403).json({ error: 'Messaging is disabled for this conversation' });
    }

    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO direct_messages (id, conversation_id, sender_user_id, body)
       VALUES (?, ?, ?, ?)`,
      [id, req.params.id, req.user.id, String(req.body.body).slice(0, 4000)],
    );
    await db.query('UPDATE direct_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    await createNotification(
      conversation.otherUserId,
      'direct_message',
      'New message',
      `${req.user.username || 'Another owner'} sent you a message.`,
    );
    res.status(201).json({ id, conversation_id: req.params.id, sender_user_id: req.user.id, body: req.body.body });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
