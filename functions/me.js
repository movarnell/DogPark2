const express = require('express');
const db = require('./db');
const { clearSessionCookie, requireAuth, setSessionCookie } = require('./auth');
const { isDevAuthUserId, publicDevUser, updateDevUser } = require('./devAuthFallback');
const { handleRouteError, normalizeOptionalUrl } = require('./validation');

const router = express.Router();

function publicUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    human_name: row.full_name,
    email: row.email,
    username: row.username,
    role: row.role || 'member',
    bio: row.bio || '',
    homeCity: row.home_city || '',
    avatarUrl: row.avatar_url || '',
    messagesEnabled: row.messages_enabled !== 0,
    activityVisibility: row.activity_visibility || 'owner_and_dog',
    notificationPreferences: row.notification_preferences || null,
    createdAt: row.created_at || null,
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) {
      return res.json(publicDevUser(req.user));
    }

    const [users] = await db.query(
      'SELECT id, full_name, email, username, role, bio, home_city, avatar_url, messages_enabled, activity_visibility, notification_preferences, created_at FROM users WHERE id = ?',
      [req.user.id],
    );
    if (!users[0]) return res.status(404).json({ error: 'User not found' });
    res.json(publicUser(users[0]));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.patch('/', requireAuth, async (req, res) => {
  try {
    const safeAvatarUrl = req.body.avatarUrl === '' ? '' : normalizeOptionalUrl(req.body.avatarUrl, 'Avatar URL');

    if (isDevAuthUserId(req.user.id)) {
      const user = updateDevUser(req.user.id, { ...req.body, avatarUrl: safeAvatarUrl }) || publicDevUser(req.user, { ...req.body, avatarUrl: safeAvatarUrl });
      setSessionCookie(res, {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        devAuthFallback: true,
      });
      return res.json(user);
    }

    await db.query(
      `UPDATE users
       SET full_name = COALESCE(?, full_name),
           username = COALESCE(?, username),
           bio = COALESCE(?, bio),
           home_city = COALESCE(?, home_city),
           avatar_url = COALESCE(?, avatar_url),
           messages_enabled = COALESCE(?, messages_enabled),
           activity_visibility = COALESCE(?, activity_visibility),
           notification_preferences = COALESCE(?, notification_preferences),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        req.body.fullName || req.body.human_name || null,
        req.body.username || null,
        req.body.bio ?? null,
        req.body.homeCity ?? null,
        safeAvatarUrl,
        req.body.messagesEnabled === undefined ? null : (req.body.messagesEnabled ? 1 : 0),
        req.body.activityVisibility || null,
        req.body.notificationPreferences ? JSON.stringify(req.body.notificationPreferences) : null,
        req.user.id,
      ],
    );
    const [users] = await db.query(
      'SELECT id, full_name, email, username, role, bio, home_city, avatar_url, messages_enabled, activity_visibility, notification_preferences, created_at FROM users WHERE id = ?',
      [req.user.id],
    );
    setSessionCookie(res, users[0]);
    res.json(publicUser(users[0]));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.delete('/', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) {
      clearSessionCookie(res);
      return res.status(204).end();
    }

    await db.query('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.user.id]);
    clearSessionCookie(res);
    res.status(204).end();
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
