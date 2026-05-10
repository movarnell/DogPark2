const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const { requireAuth } = require('./auth');
const {
  createDevNotification,
  createDevVisit,
  followDevUser,
  isDevAuthUserId,
  listDevNotifications,
  listDevVisits,
  setDevVisitInterest,
  unfollowDevUser,
  updateDevVisit,
} = require('./devAuthFallback');
const { handleRouteError, normalizeOptionalUrl, requireFields } = require('./validation');
const {
  presentVisit,
  relationshipGroupFields,
  relationshipJoinParams,
  relationshipJoins,
  relationshipSelectFields,
  relationshipWhere,
} = require('./visitPrivacy');

const router = express.Router();

function visitSelectFields(includeParkRef = true, includeViewer = false) {
  return `SELECT v.id,
              ${includeParkRef ? 'v.park_ref,' : ''}
              v.user_id AS owner_user_id,
              v.starts_at, v.duration_minutes, v.status, v.notes, v.social_intent,
              u.username, u.full_name,
              d.id AS dog_id,
              CASE WHEN d.is_public = 1 THEN d.name ELSE NULL END AS dog_name,
              CASE WHEN d.is_public = 1 THEN d.size ELSE NULL END AS dog_size,
              CASE WHEN d.is_public = 1 THEN d.breed ELSE NULL END AS dog_breed,
              CASE WHEN d.is_public = 1 THEN d.breed_key ELSE NULL END AS dog_breed_key,
              CASE WHEN d.is_public = 1 THEN d.avatar_url ELSE NULL END AS dog_avatar_url,
              COUNT(DISTINCT vi.user_id) AS interest_count,
              ${relationshipSelectFields(includeViewer)}`;
}

function visitJoins(currentUserId) {
  return `FROM visits v
       JOIN users u ON u.id = v.user_id
       LEFT JOIN dogs d ON d.id = v.dog_id AND d.deleted_at IS NULL
       LEFT JOIN visit_interests vi ON vi.visit_id = v.id
       ${currentUserId ? 'LEFT JOIN visit_interests my_vi ON my_vi.visit_id = v.id AND my_vi.user_id = ?' : ''}
       ${relationshipJoins('v.user_id', Boolean(currentUserId))}`;
}

function visitGroupFields(includeParkRef = true, currentUserId = '') {
  return `GROUP BY v.id${includeParkRef ? ', v.park_ref' : ''}, v.user_id, v.starts_at, v.duration_minutes, v.status,
              v.notes, v.social_intent, u.username, u.full_name, d.id, d.is_public, d.name, d.size, d.breed, d.breed_key, d.avatar_url${
                currentUserId ? ', my_vi.user_id' : ''
              }${relationshipGroupFields(Boolean(currentUserId))}`;
}

async function createNotification(userId, type, title, body) {
  if (!userId) return;
  await db.query(
    `INSERT INTO notifications (id, user_id, type, title, body)
     VALUES (?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), userId, type, title, body],
  );
}

async function notifyFriendsOfVisit(user, parkRef) {
  const [friends] = await db.query(
    `SELECT CASE WHEN requester_user_id = ? THEN addressee_user_id ELSE requester_user_id END AS friend_user_id
     FROM friendships f
     LEFT JOIN user_blocks b1
       ON b1.blocker_user_id = ? AND b1.blocked_user_id = CASE WHEN requester_user_id = ? THEN addressee_user_id ELSE requester_user_id END
     LEFT JOIN user_blocks b2
       ON b2.blocker_user_id = CASE WHEN requester_user_id = ? THEN addressee_user_id ELSE requester_user_id END AND b2.blocked_user_id = ?
     WHERE status = 'accepted'
       AND (requester_user_id = ? OR addressee_user_id = ?)
       AND b1.blocker_user_id IS NULL
       AND b2.blocker_user_id IS NULL`,
    [user.id, user.id, user.id, user.id, user.id, user.id, user.id],
  );
  await Promise.all(
    friends.map((friend) =>
      createNotification(
        friend.friend_user_id,
        'friend_visit',
        'Friend scheduled a park visit',
        `${user.username || 'A friend'} scheduled a visit at ${parkRef}.`,
      ),
    ),
  );
}

router.get('/visits', async (req, res) => {
  try {
    const currentUserId = req.user && !isDevAuthUserId(req.user.id) ? req.user.id : '';
    const params = currentUserId ? [currentUserId, ...relationshipJoinParams(currentUserId)] : [];
    let where = 'WHERE v.starts_at >= CURRENT_TIMESTAMP';
    if (req.query.parkId) {
      where += ' AND v.park_ref = ?';
      params.push(req.query.parkId);
    }
    if (req.query.mine === 'true') {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      if (isDevAuthUserId(req.user.id)) {
        return res.json(listDevVisits({ ownerId: req.user.id, mineOnly: true }));
      }
      where += ' AND v.user_id = ?';
      params.push(req.user.id);
    } else if (req.user && isDevAuthUserId(req.user.id)) {
      return res.json(listDevVisits({ ownerId: req.user.id, parkId: req.query.parkId || '' }));
    }
    where += relationshipWhere(Boolean(currentUserId));

    const [visits] = await db.query(
      `${visitSelectFields(true, Boolean(currentUserId))}
              ${req.user ? ', my_vi.user_id IS NOT NULL AS is_interested' : ', FALSE AS is_interested'}
       ${visitJoins(req.user?.id)}
       ${where}
       ${visitGroupFields(true, req.user?.id)}
       ORDER BY v.starts_at ASC
       LIMIT 100`,
      params,
    );
    res.json(visits.map((visit) => presentVisit(visit, req.user?.id || '')));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/visits', requireAuth, async (req, res) => {
  try {
    requireFields(req.body, ['parkId', 'startsAt']);
    if (isDevAuthUserId(req.user.id)) {
      const visit = createDevVisit(req.user, req.body);
      if (!visit) return res.status(403).json({ error: 'Dog is not available for this visit' });
      return res.status(201).json({ id: visit.id, status: visit.status });
    }

    if (req.body.dogId) {
      const [dogs] = await db.query(
        'SELECT id FROM dogs WHERE id = ? AND owner_id = ? AND deleted_at IS NULL LIMIT 1',
        [req.body.dogId, req.user.id],
      );
      if (!dogs[0]) return res.status(403).json({ error: 'Dog is not available for this visit' });
    }

    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO visits (id, user_id, park_ref, dog_id, starts_at, duration_minutes, notes, social_intent, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'planned')`,
      [
        id,
        req.user.id,
        req.body.parkId,
        req.body.dogId || null,
        req.body.startsAt,
        req.body.durationMinutes || 60,
        req.body.notes || null,
        req.body.socialIntent || req.body.social_intent || null,
      ],
    );
    await notifyFriendsOfVisit(req.user, req.body.parkId);
    res.status(201).json({ id, status: 'planned' });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.patch('/visits/:id', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) {
      const visit = updateDevVisit(req.user, req.params.id, req.body);
      if (!visit) return res.status(404).json({ error: 'Visit not found' });
      return res.json({ id: req.params.id });
    }

    await db.query(
      `UPDATE visits
       SET starts_at = COALESCE(?, starts_at),
           duration_minutes = COALESCE(?, duration_minutes),
           notes = COALESCE(?, notes),
           social_intent = COALESCE(?, social_intent),
           status = COALESCE(?, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        req.body.startsAt || null,
        req.body.durationMinutes || null,
        req.body.notes ?? null,
        req.body.socialIntent ?? req.body.social_intent ?? null,
        req.body.status || null,
        req.params.id,
        req.user.id,
      ],
    );
    res.json({ id: req.params.id });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/visits/:id/check-in', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) {
      const visit = updateDevVisit(req.user, req.params.id, { status: 'checked_in' });
      if (!visit) return res.status(404).json({ error: 'Visit not found' });
      createDevNotification(req.user.id, 'visit_checkin', 'You checked in', `Checked in at ${visit.park_ref}.`);
      return res.json({ id: req.params.id, status: 'checked_in' });
    }

    await db.query(
      `UPDATE visits
       SET status = 'checked_in', checked_in_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id],
    );
    const [visits] = await db.query('SELECT park_ref FROM visits WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (visits[0]) {
      await createNotification(req.user.id, 'visit_checkin', 'You checked in', `Checked in at ${visits[0].park_ref}.`);
    }
    res.json({ id: req.params.id, status: 'checked_in' });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/visits/:id/interest', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) {
      const visit = setDevVisitInterest(req.user, req.params.id, true);
      if (!visit) return res.status(404).json({ error: 'Visit not found' });
      return res.json({ id: req.params.id, interested: true, interestCount: visit.interest_count });
    }

    const [visits] = await db.query('SELECT id, user_id, park_ref FROM visits WHERE id = ? AND status != "cancelled"', [
      req.params.id,
    ]);
    const visit = visits[0];
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    if (String(visit.user_id) === String(req.user.id)) return res.status(400).json({ error: 'Cannot mark interest in your own visit' });
    const [blocks] = await db.query(
      `SELECT blocker_user_id
       FROM user_blocks
       WHERE (blocker_user_id = ? AND blocked_user_id = ?)
          OR (blocker_user_id = ? AND blocked_user_id = ?)
       LIMIT 1`,
      [req.user.id, visit.user_id, visit.user_id, req.user.id],
    );
    if (blocks[0]) return res.status(403).json({ error: 'This visit is not available' });

    await db.query('INSERT IGNORE INTO visit_interests (visit_id, user_id) VALUES (?, ?)', [req.params.id, req.user.id]);
    await createNotification(
      visit.user_id,
      'visit_interest',
      'Someone is interested in your visit',
      `${req.user.username || 'Another owner'} is interested in your plan at ${visit.park_ref}.`,
    );
    const [counts] = await db.query('SELECT COUNT(*) AS interest_count FROM visit_interests WHERE visit_id = ?', [req.params.id]);
    res.json({ id: req.params.id, interested: true, interestCount: Number(counts[0]?.interest_count || 0) });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.delete('/visits/:id/interest', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) {
      const visit = setDevVisitInterest(req.user, req.params.id, false);
      if (!visit) return res.status(404).json({ error: 'Visit not found' });
      return res.json({ id: req.params.id, interested: false, interestCount: visit.interest_count });
    }

    await db.query('DELETE FROM visit_interests WHERE visit_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    const [counts] = await db.query('SELECT COUNT(*) AS interest_count FROM visit_interests WHERE visit_id = ?', [req.params.id]);
    res.json({ id: req.params.id, interested: false, interestCount: Number(counts[0]?.interest_count || 0) });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get('/reviews', async (req, res) => {
  try {
    const params = [];
    let where = "WHERE r.status = 'published'";
    const currentUserId = req.user && !isDevAuthUserId(req.user.id) ? req.user.id : '';
    if (req.query.parkId) {
      where += ' AND r.park_ref = ?';
      params.push(req.query.parkId);
    }
    if (currentUserId) {
      where += ` AND blocked_by_author.blocker_user_id IS NULL AND blocked_author.blocker_user_id IS NULL`;
      params.unshift(currentUserId, currentUserId);
    }
    const [reviews] = await db.query(
      `SELECT r.id, r.park_ref, r.rating, r.title, r.body, r.helpful_count, r.created_at,
              u.username, u.full_name
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       ${
         currentUserId
           ? `LEFT JOIN user_blocks blocked_by_author ON blocked_by_author.blocker_user_id = r.user_id AND blocked_by_author.blocked_user_id = ?
              LEFT JOIN user_blocks blocked_author ON blocked_author.blocker_user_id = ? AND blocked_author.blocked_user_id = r.user_id`
           : ''
       }
       ${where}
       ORDER BY r.created_at DESC
       LIMIT 100`,
      params,
    );
    res.json(reviews.map((review) => (req.user ? review : { ...review, username: '', full_name: '' })));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/reviews', requireAuth, async (req, res) => {
  try {
    requireFields(req.body, ['parkId', 'rating', 'body']);
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO reviews (id, park_ref, user_id, rating, title, body, status)
       VALUES (?, ?, ?, ?, ?, ?, 'published')`,
      [id, req.body.parkId, req.user.id, req.body.rating, req.body.title || null, req.body.body],
    );
    res.status(201).json({ id, status: 'published' });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/reviews/:id/helpful', requireAuth, async (req, res) => {
  try {
    await db.query(
      `INSERT IGNORE INTO review_votes (review_id, user_id) VALUES (?, ?)`,
      [req.params.id, req.user.id],
    );
    await db.query(
      `UPDATE reviews
       SET helpful_count = (SELECT COUNT(*) FROM review_votes WHERE review_id = ?)
       WHERE id = ?`,
      [req.params.id, req.params.id],
    );
    res.status(204).end();
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/photos', requireAuth, async (req, res) => {
  try {
    requireFields(req.body, ['parkId', 'imageUrl']);
    const id = crypto.randomUUID();
    const safeImageUrl = normalizeOptionalUrl(req.body.imageUrl, 'Photo URL');
    await db.query(
      `INSERT INTO photos (id, park_ref, user_id, image_url, caption, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [id, req.body.parkId, req.user.id, safeImageUrl, req.body.caption || null],
    );
    res.status(201).json({ id, status: 'pending' });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/reports', requireAuth, async (req, res) => {
  try {
    requireFields(req.body, ['targetType', 'targetId', 'reason']);
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO reports (id, reporter_user_id, target_type, target_id, reason, details, status)
       VALUES (?, ?, ?, ?, ?, ?, 'open')`,
      [
        id,
        req.user.id,
        req.body.targetType,
        req.body.targetId,
        req.body.reason,
        req.body.details || null,
      ],
    );
    res.status(201).json({ id, status: 'open' });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/follows', requireAuth, async (req, res) => {
  try {
    requireFields(req.body, ['userId']);
    if (isDevAuthUserId(req.user.id)) {
      followDevUser(req.user.id, req.body.userId);
      return res.status(204).end();
    }

    await db.query(
      `INSERT IGNORE INTO follows (follower_user_id, followed_user_id) VALUES (?, ?)`,
      [req.user.id, req.body.userId],
    );
    await createNotification(req.body.userId, 'owner_follow', 'New follower', `${req.user.username || 'Another owner'} followed your park plans.`);
    res.status(204).end();
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.delete('/follows/:userId', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) {
      unfollowDevUser(req.user.id, req.params.userId);
      return res.status(204).end();
    }

    await db.query('DELETE FROM follows WHERE follower_user_id = ? AND followed_user_id = ?', [
      req.user.id,
      req.params.userId,
    ]);
    res.status(204).end();
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get('/notifications', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) {
      return res.json(listDevNotifications(req.user.id));
    }

    const [notifications] = await db.query(
      `SELECT id, type, title, body, read_at, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id],
    );
    res.json(notifications);
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
