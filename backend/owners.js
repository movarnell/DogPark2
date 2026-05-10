const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const config = require('./config');
const db = require('./db');
const { clearSessionCookie, parseCookies, requireAdmin, requireAuth, setSessionCookie } = require('./auth');
const {
  canUseDevAuthFallback,
  createDevGoogleUser,
  createDevPasswordUser,
  findDevPasswordUserByEmail,
  findDevPasswordUserByUsername,
  isDevAuthUserId,
  publicDevUser,
  updateDevUser,
} = require('./devAuthFallback');
const { handleRouteError, isEmail, normalizeOptionalUrl, requireFields } = require('./validation');

const router = express.Router();
const GOOGLE_STATE_COOKIE = 'dogpark_google_oauth_state';
const APPLE_STATE_COOKIE = 'dogpark_apple_oauth_state';
const APPLE_NONCE_COOKIE = 'dogpark_apple_oauth_nonce';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
let googleJwksCache = { keys: null, expiresAt: 0 };
let appleJwksCache = { keys: null, expiresAt: 0 };

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    human_name: row.human_name || row.full_name || '',
    fullName: row.full_name || row.human_name || '',
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

function appendSetCookie(res, cookieValue) {
  const current = res.getHeader('Set-Cookie');
  if (!current) {
    res.setHeader('Set-Cookie', cookieValue);
    return;
  }
  res.setHeader('Set-Cookie', Array.isArray(current) ? [...current, cookieValue] : [current, cookieValue]);
}

function setOAuthCookie(res, name, value) {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'Max-Age=600',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (config.cookieSecure) attributes.push('Secure');
  appendSetCookie(res, attributes.join('; '));
}

function clearOAuthCookie(res, name) {
  appendSetCookie(
    res,
    `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${config.cookieSecure ? '; Secure' : ''}`,
  );
}

function setGoogleStateCookie(res, state) {
  setOAuthCookie(res, GOOGLE_STATE_COOKIE, state);
}

function setAppleStateCookie(res, state, nonce) {
  setOAuthCookie(res, APPLE_STATE_COOKIE, state);
  setOAuthCookie(res, APPLE_NONCE_COOKIE, nonce);
}

function clearGoogleStateCookie(res) {
  clearOAuthCookie(res, GOOGLE_STATE_COOKIE);
}

function clearAppleStateCookie(res) {
  clearOAuthCookie(res, APPLE_STATE_COOKIE);
  clearOAuthCookie(res, APPLE_NONCE_COOKIE);
}

function redirectToFrontend(res, path) {
  res.redirect(`${config.frontendBaseUrl}${path}`);
}

function isGoogleOAuthConfigured() {
  return Boolean(config.googleOAuthClientId && config.googleOAuthClientSecret && config.googleOAuthRedirectUri);
}

function googleNativeAudiences() {
  return [config.googleIOSClientId, config.googleOAuthClientId].filter(Boolean);
}

function isGoogleNativeConfigured() {
  return googleNativeAudiences().length > 0;
}

function isAppleOAuthConfigured() {
  return Boolean(
    config.appleOAuthClientId &&
      config.appleOAuthTeamId &&
      config.appleOAuthKeyId &&
      config.appleOAuthPrivateKey &&
      config.appleOAuthRedirectUri,
  );
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeJwtPart(encodedPart) {
  if (!encodedPart) return null;
  try {
    return JSON.parse(Buffer.from(encodedPart, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function decodeJwtHeader(token) {
  const [encodedHeader] = String(token || '').split('.');
  return decodeJwtPart(encodedHeader);
}

function decodeJwtPayload(token) {
  const [, encodedPayload] = String(token || '').split('.');
  return decodeJwtPart(encodedPayload);
}

async function fetchGoogleJwks() {
  if (googleJwksCache.keys && googleJwksCache.expiresAt > Date.now()) return googleJwksCache.keys;

  const response = await fetch(GOOGLE_JWKS_URL);
  const data = await response.json();
  if (!response.ok || !Array.isArray(data.keys)) {
    const error = new Error('Google signing keys could not be loaded');
    error.statusCode = 502;
    throw error;
  }

  googleJwksCache = {
    keys: data.keys,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
  return googleJwksCache.keys;
}

async function verifyGoogleIdTokenSignature(idToken, header) {
  const [encodedHeader, encodedPayload, encodedSignature] = String(idToken || '').split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature || !header?.kid || !header?.alg) {
    const error = new Error('Google identity token was malformed');
    error.statusCode = 401;
    throw error;
  }
  if (header.alg !== 'RS256') {
    const error = new Error('Google identity token algorithm was not accepted');
    error.statusCode = 401;
    throw error;
  }

  const keys = await fetchGoogleJwks();
  const jwk = keys.find((key) => key.kid === header.kid && (!key.alg || key.alg === header.alg));
  if (!jwk) {
    const error = new Error('Google identity token signing key was not found');
    error.statusCode = 401;
    throw error;
  }

  const valid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    crypto.createPublicKey({ key: jwk, format: 'jwk' }),
    Buffer.from(encodedSignature, 'base64url'),
  );
  if (!valid) {
    const error = new Error('Google identity token signature was invalid');
    error.statusCode = 401;
    throw error;
  }
}

async function fetchAppleJwks() {
  if (appleJwksCache.keys && appleJwksCache.expiresAt > Date.now()) return appleJwksCache.keys;

  const response = await fetch(APPLE_JWKS_URL);
  const data = await response.json();
  if (!response.ok || !Array.isArray(data.keys)) {
    const error = new Error('Apple signing keys could not be loaded');
    error.statusCode = 502;
    throw error;
  }

  appleJwksCache = {
    keys: data.keys,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
  return appleJwksCache.keys;
}

async function verifyAppleIdTokenSignature(idToken, header) {
  const [encodedHeader, encodedPayload, encodedSignature] = String(idToken || '').split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature || !header?.kid || !header?.alg) {
    const error = new Error('Apple identity token was malformed');
    error.statusCode = 401;
    throw error;
  }
  if (!['RS256', 'ES256'].includes(header.alg)) {
    const error = new Error('Apple identity token algorithm was not accepted');
    error.statusCode = 401;
    throw error;
  }

  const keys = await fetchAppleJwks();
  const jwk = keys.find((key) => key.kid === header.kid && (!key.alg || key.alg === header.alg));
  if (!jwk) {
    const error = new Error('Apple identity token signing key was not found');
    error.statusCode = 401;
    throw error;
  }

  const verifier = header.alg === 'RS256' ? 'RSA-SHA256' : 'sha256';
  const valid = crypto.verify(
    verifier,
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    crypto.createPublicKey({ key: jwk, format: 'jwk' }),
    Buffer.from(encodedSignature, 'base64url'),
  );
  if (!valid) {
    const error = new Error('Apple identity token signature was invalid');
    error.statusCode = 401;
    throw error;
  }
}

function createAppleClientSecret() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlJson({ alg: 'ES256', kid: config.appleOAuthKeyId, typ: 'JWT' });
  const payload = base64urlJson({
    iss: config.appleOAuthTeamId,
    iat: now,
    exp: now + 60 * 60 * 24 * 30,
    aud: 'https://appleid.apple.com',
    sub: config.appleOAuthClientId,
  });
  const signingInput = `${header}.${payload}`;
  const signature = crypto
    .sign('sha256', Buffer.from(signingInput), {
      key: config.appleOAuthPrivateKey,
      dsaEncoding: 'ieee-p1363',
    })
    .toString('base64url');
  return `${signingInput}.${signature}`;
}

function normalizeUsername(value) {
  const base = String(value || 'dogpark-user')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return base || 'dogpark-user';
}

async function uniqueUsername(profile) {
  const emailPrefix = profile.email?.split('@')[0];
  const base = normalizeUsername(profile.name || emailPrefix || 'dogpark-user');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = attempt === 0 ? '' : String(1000 + crypto.randomInt(9000));
    const candidate = `${base}${suffix}`.slice(0, 80);
    const [existing] = await db.query('SELECT id FROM users WHERE username = ? LIMIT 1', [candidate]);
    if (!existing[0]) return candidate;
  }
  return `dogpark_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

async function findGoogleUser(profile) {
  try {
    const [users] = await db.query(
      `SELECT id, full_name, email, username, role, bio, home_city, avatar_url, google_sub
       FROM users
       WHERE deleted_at IS NULL AND (google_sub = ? OR email = ?)
       ORDER BY google_sub = ? DESC
       LIMIT 1`,
      [profile.sub, profile.email, profile.sub],
    );
    return users[0] || null;
  } catch (error) {
    if (error.code !== 'ER_BAD_FIELD_ERROR') throw error;
    const [users] = await db.query(
      `SELECT id, full_name, email, username, role, bio, home_city
       FROM users
       WHERE deleted_at IS NULL AND email = ?
       LIMIT 1`,
      [profile.email],
    );
    return users[0] || null;
  }
}

async function findAppleUser(profile) {
  try {
    const params = profile.email ? [profile.sub, profile.email, profile.sub] : [profile.sub, profile.sub];
    const [users] = await db.query(
      profile.email
        ? `SELECT id, full_name, email, username, role, bio, home_city, avatar_url, apple_sub
           FROM users
           WHERE deleted_at IS NULL AND (apple_sub = ? OR email = ?)
           ORDER BY apple_sub = ? DESC
           LIMIT 1`
        : `SELECT id, full_name, email, username, role, bio, home_city, avatar_url, apple_sub
           FROM users
           WHERE deleted_at IS NULL AND apple_sub = ?
           ORDER BY apple_sub = ? DESC
           LIMIT 1`,
      params,
    );
    return users[0] || null;
  } catch (error) {
    if (error.code !== 'ER_BAD_FIELD_ERROR') throw error;
    if (!profile.email) return null;
    const [users] = await db.query(
      `SELECT id, full_name, email, username, role, bio, home_city
       FROM users
       WHERE deleted_at IS NULL AND email = ?
       LIMIT 1`,
      [profile.email],
    );
    return users[0] || null;
  }
}

async function updateGoogleUser(userId, profile) {
  try {
    await db.query(
      `UPDATE users
       SET google_sub = COALESCE(google_sub, ?),
           avatar_url = COALESCE(?, avatar_url),
           last_login_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [profile.sub, profile.picture || null, userId],
    );
  } catch (error) {
    if (error.code !== 'ER_BAD_FIELD_ERROR') throw error;
    await db.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
  }
}

async function updateAppleUser(userId, profile) {
  try {
    await db.query(
      `UPDATE users
       SET apple_sub = COALESCE(apple_sub, ?),
           last_login_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [profile.sub, userId],
    );
  } catch (error) {
    if (error.code !== 'ER_BAD_FIELD_ERROR') throw error;
    await db.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
  }
}

async function createGoogleUser(profile) {
  const fullName = profile.name || profile.email;
  const username = await uniqueUsername(profile);
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('base64url'), 12);

  try {
    const [result] = await db.query(
      `INSERT INTO users (full_name, email, username, password_hash, google_sub, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fullName, profile.email, username, passwordHash, profile.sub, profile.picture || null],
    );
    return {
      id: result.insertId,
      full_name: fullName,
      email: profile.email,
      username,
      role: 'member',
      avatar_url: profile.picture || '',
    };
  } catch (error) {
    if (error.code !== 'ER_BAD_FIELD_ERROR') throw error;
    const [result] = await db.query(
      'INSERT INTO users (full_name, email, username, password_hash) VALUES (?, ?, ?, ?)',
      [fullName, profile.email, username, passwordHash],
    );
    return {
      id: result.insertId,
      full_name: fullName,
      email: profile.email,
      username,
      role: 'member',
    };
  }
}

async function createAppleUser(profile) {
  if (!profile.email) {
    const error = new Error('Apple account did not provide an email address');
    error.statusCode = 401;
    throw error;
  }

  const fullName = profile.name || profile.email;
  const username = await uniqueUsername(profile);
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('base64url'), 12);

  try {
    const [result] = await db.query(
      `INSERT INTO users (full_name, email, username, password_hash, apple_sub)
       VALUES (?, ?, ?, ?, ?)`,
      [fullName, profile.email, username, passwordHash, profile.sub],
    );
    return {
      id: result.insertId,
      full_name: fullName,
      email: profile.email,
      username,
      role: 'member',
    };
  } catch (error) {
    if (error.code !== 'ER_BAD_FIELD_ERROR') throw error;
    const [result] = await db.query(
      'INSERT INTO users (full_name, email, username, password_hash) VALUES (?, ?, ?, ?)',
      [fullName, profile.email, username, passwordHash],
    );
    return {
      id: result.insertId,
      full_name: fullName,
      email: profile.email,
      username,
      role: 'member',
    };
  }
}

async function exchangeGoogleCode(code) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.googleOAuthClientId,
      client_secret: config.googleOAuthClientSecret,
      redirect_uri: config.googleOAuthRedirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error_description || data.error || 'Google sign-in failed');
    error.statusCode = 502;
    throw error;
  }
  return data;
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await response.json();
  if (!response.ok) {
    const error = new Error(profile.error_description || profile.error || 'Google profile lookup failed');
    error.statusCode = 502;
    throw error;
  }
  if (!profile.sub || !profile.email || !profile.email_verified) {
    const error = new Error('Google account email must be verified');
    error.statusCode = 401;
    throw error;
  }
  return {
    sub: String(profile.sub),
    email: String(profile.email).toLowerCase(),
    name: profile.name || '',
    picture: profile.picture || '',
  };
}

async function googleProfileFromIdToken(idToken, fallback = {}) {
  const header = decodeJwtHeader(idToken);
  const payload = decodeJwtPayload(idToken);
  if (!header || !payload) {
    const error = new Error('Google identity token was invalid');
    error.statusCode = 401;
    throw error;
  }
  await verifyGoogleIdTokenSignature(idToken, header);

  const now = Math.floor(Date.now() / 1000);
  const audiences = googleNativeAudiences();
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    const error = new Error('Google identity token issuer was not accepted');
    error.statusCode = 401;
    throw error;
  }
  if (!audiences.includes(payload.aud) || payload.exp < now) {
    const error = new Error('Google identity token was not accepted');
    error.statusCode = 401;
    throw error;
  }
  if (!payload.sub || !payload.email || payload.email_verified !== true) {
    const error = new Error('Google account email must be verified');
    error.statusCode = 401;
    throw error;
  }

  return {
    sub: String(payload.sub),
    email: String(payload.email).toLowerCase(),
    name: payload.name || fallback.fullName || '',
    picture: payload.picture || fallback.avatarUrl || '',
  };
}

async function exchangeAppleCode(code) {
  const response = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.appleOAuthClientId,
      client_secret: createAppleClientSecret(),
      redirect_uri: config.appleOAuthRedirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error_description || data.error || 'Apple sign-in failed');
    error.statusCode = 502;
    throw error;
  }
  return data;
}

function parseAppleName(rawUser) {
  if (!rawUser) return '';
  try {
    const user = typeof rawUser === 'string' ? JSON.parse(rawUser) : rawUser;
    const firstName = user?.name?.firstName || '';
    const lastName = user?.name?.lastName || '';
    return [firstName, lastName].filter(Boolean).join(' ');
  } catch {
    return '';
  }
}

async function appleProfileFromIdToken(idToken, rawUser, expectedNonce) {
  const header = decodeJwtHeader(idToken);
  const payload = decodeJwtPayload(idToken);
  if (!header || !payload) {
    const error = new Error('Apple identity token was invalid');
    error.statusCode = 401;
    throw error;
  }
  await verifyAppleIdTokenSignature(idToken, header);

  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== 'https://appleid.apple.com' || payload.aud !== config.appleOAuthClientId || payload.exp < now) {
    const error = new Error('Apple identity token was not accepted');
    error.statusCode = 401;
    throw error;
  }
  if (!payload.sub || (expectedNonce && payload.nonce !== expectedNonce)) {
    const error = new Error('Apple identity token nonce was not accepted');
    error.statusCode = 401;
    throw error;
  }
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
  if (payload.email && !emailVerified) {
    const error = new Error('Apple account email must be verified');
    error.statusCode = 401;
    throw error;
  }
  return {
    sub: String(payload.sub),
    email: payload.email ? String(payload.email).toLowerCase() : '',
    name: parseAppleName(rawUser),
  };
}

router.get('/', requireAdmin, async (_req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, full_name, email, username, role, bio, home_city, created_at FROM users ORDER BY created_at DESC LIMIT 100',
    );
    res.json(users.map(publicUser));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get('/me', requireAuth, async (req, res) => {
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

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const safeAvatarUrl = req.body.avatarUrl === '' ? '' : normalizeOptionalUrl(req.body.avatarUrl, 'Avatar URL');
    const { fullName, human_name, username, bio, homeCity, notificationPreferences, messagesEnabled, activityVisibility } = req.body;
    const displayName = fullName || human_name;

    if (isDevAuthUserId(req.user.id)) {
      const user = updateDevUser(req.user.id, {
        fullName: displayName,
        username,
        bio,
        homeCity,
        avatarUrl: safeAvatarUrl,
        notificationPreferences,
        messagesEnabled,
        activityVisibility,
      }) || publicDevUser(req.user, { ...req.body, avatarUrl: safeAvatarUrl });
      setSessionCookie(res, user);
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
        displayName || null,
        username || null,
        bio ?? null,
        homeCity ?? null,
        safeAvatarUrl,
        messagesEnabled === undefined ? null : (messagesEnabled ? 1 : 0),
        activityVisibility || null,
        notificationPreferences ? JSON.stringify(notificationPreferences) : null,
        req.user.id,
      ],
    );

    const [users] = await db.query(
      'SELECT id, full_name, email, username, role, bio, home_city, avatar_url, messages_enabled, activity_visibility, notification_preferences, created_at FROM users WHERE id = ?',
      [req.user.id],
    );
    res.json(publicUser(users[0]));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.delete('/me', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) {
      clearSessionCookie(res);
      return res.status(204).end();
    }

    await db.query('UPDATE users SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      req.user.id,
    ]);
    clearSessionCookie(res);
    res.status(204).end();
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get('/google', (_req, res) => {
  if (!isGoogleOAuthConfigured()) {
    return redirectToFrontend(res, '/login?error=google_not_configured');
  }

  const state = crypto.randomBytes(32).toString('base64url');
  setGoogleStateCookie(res, state);
  const params = new URLSearchParams({
    client_id: config.googleOAuthClientId,
    redirect_uri: config.googleOAuthRedirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  try {
    clearGoogleStateCookie(res);

    if (req.query.error) {
      return redirectToFrontend(res, `/login?error=${encodeURIComponent(String(req.query.error))}`);
    }
    if (!isGoogleOAuthConfigured()) {
      return redirectToFrontend(res, '/login?error=google_not_configured');
    }

    const cookies = parseCookies(req.headers.cookie);
    if (!req.query.state || cookies[GOOGLE_STATE_COOKIE] !== req.query.state) {
      return redirectToFrontend(res, '/login?error=invalid_google_state');
    }
    if (!req.query.code) {
      return redirectToFrontend(res, '/login?error=missing_google_code');
    }

    const tokenData = await exchangeGoogleCode(String(req.query.code));
    const profile = await fetchGoogleProfile(tokenData.access_token);
    let user;
    try {
      user = await findGoogleUser(profile);

      if (user) {
        await updateGoogleUser(user.id, profile);
        user = { ...user, google_sub: profile.sub, avatar_url: profile.picture || user.avatar_url };
      } else {
        user = await createGoogleUser(profile);
      }
    } catch (databaseError) {
      if (!canUseDevAuthFallback(databaseError)) throw databaseError;
      console.warn('Google sign-in using local development auth fallback because the database is unavailable', {
        code: databaseError.code,
      });
      user = createDevGoogleUser(profile);
    }

    setSessionCookie(res, user);
    redirectToFrontend(res, '/?signedIn=google');
  } catch (error) {
    console.error('Google sign-in failed', error);
    redirectToFrontend(res, '/login?error=google_failed');
  }
});

router.post('/google/native', async (req, res) => {
  try {
    if (!isGoogleNativeConfigured()) {
      return res.status(503).json({ error: 'Google sign-in is not configured' });
    }
    requireFields(req.body, ['identityToken']);

    const profile = await googleProfileFromIdToken(String(req.body.identityToken), {
      fullName: req.body.fullName ? String(req.body.fullName) : '',
      avatarUrl: req.body.avatarUrl ? String(req.body.avatarUrl) : '',
    });

    let user;
    try {
      user = await findGoogleUser(profile);

      if (user) {
        await updateGoogleUser(user.id, profile);
        user = { ...user, google_sub: profile.sub, avatar_url: profile.picture || user.avatar_url };
      } else {
        user = await createGoogleUser(profile);
      }
    } catch (databaseError) {
      if (!canUseDevAuthFallback(databaseError)) throw databaseError;
      console.warn('Native Google sign-in using local development auth fallback because the database is unavailable', {
        code: databaseError.code,
      });
      user = createDevGoogleUser(profile);
    }

    setSessionCookie(res, user);
    res.status(201).json(publicUser(user));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get('/apple', (_req, res) => {
  if (!isAppleOAuthConfigured()) {
    return redirectToFrontend(res, '/login?error=apple_not_configured');
  }

  const state = crypto.randomBytes(32).toString('base64url');
  const nonce = crypto.randomBytes(32).toString('base64url');
  setAppleStateCookie(res, state, nonce);
  const params = new URLSearchParams({
    client_id: config.appleOAuthClientId,
    redirect_uri: config.appleOAuthRedirectUri,
    response_type: 'code',
    response_mode: 'form_post',
    scope: 'name email',
    state,
    nonce,
  });
  res.redirect(`https://appleid.apple.com/auth/authorize?${params}`);
});

async function handleAppleCallback(req, res) {
  try {
    clearAppleStateCookie(res);
    const payload = req.method === 'POST' ? req.body : req.query;

    if (payload.error) {
      return redirectToFrontend(res, `/login?error=${encodeURIComponent(String(payload.error))}`);
    }
    if (!isAppleOAuthConfigured()) {
      return redirectToFrontend(res, '/login?error=apple_not_configured');
    }

    const cookies = parseCookies(req.headers.cookie);
    if (!payload.state || cookies[APPLE_STATE_COOKIE] !== payload.state) {
      return redirectToFrontend(res, '/login?error=invalid_apple_state');
    }
    if (!cookies[APPLE_NONCE_COOKIE]) {
      return redirectToFrontend(res, '/login?error=invalid_apple_nonce');
    }
    if (!payload.code) {
      return redirectToFrontend(res, '/login?error=missing_apple_code');
    }

    const tokenData = await exchangeAppleCode(String(payload.code));
    const profile = await appleProfileFromIdToken(tokenData.id_token, payload.user, cookies[APPLE_NONCE_COOKIE]);
    let user = await findAppleUser(profile);

    if (user) {
      await updateAppleUser(user.id, profile);
      user = { ...user, apple_sub: profile.sub };
    } else {
      user = await createAppleUser(profile);
    }

    setSessionCookie(res, user);
    redirectToFrontend(res, '/?signedIn=apple');
  } catch (error) {
    console.error('Apple sign-in failed', error);
    redirectToFrontend(res, '/login?error=apple_failed');
  }
}

router.get('/apple/callback', handleAppleCallback);
router.post('/apple/callback', handleAppleCallback);

router.post('/apple/native', async (req, res) => {
  try {
    if (!isAppleOAuthConfigured()) {
      return res.status(503).json({ error: 'Apple sign-in is not configured' });
    }
    requireFields(req.body, ['identityToken']);

    const profile = await appleProfileFromIdToken(
      String(req.body.identityToken),
      req.body.fullName ? JSON.stringify({ name: req.body.fullName }) : req.body.user,
      req.body.nonce || '',
    );
    if (req.body.fullName && !profile.name) {
      profile.name = String(req.body.fullName);
    }

    let user = await findAppleUser(profile);
    if (user) {
      await updateAppleUser(user.id, profile);
      user = { ...user, apple_sub: profile.sub };
    } else {
      user = await createAppleUser(profile);
    }

    setSessionCookie(res, user);
    res.status(201).json(publicUser(user));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/register', async (req, res) => {
  let fullName = '';
  let email = '';
  let username = '';
  let passwordHash = '';
  try {
    requireFields(req.body, ['email', 'username', 'password']);
    fullName = req.body.fullName || req.body.human_name || req.body.username;
    ({ email, username } = req.body);
    const { password } = req.body;

    if (!isEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    passwordHash = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      'INSERT INTO users (full_name, email, username, password_hash) VALUES (?, ?, ?, ?)',
      [fullName, email.toLowerCase(), username, passwordHash],
    );

    const user = {
      id: result.insertId,
      full_name: fullName,
      email: email.toLowerCase(),
      username,
      role: 'member',
    };
    setSessionCookie(res, user);
    res.status(201).json(publicUser(user));
  } catch (error) {
    if (canUseDevAuthFallback(error)) {
      if (findDevPasswordUserByEmail(email) || findDevPasswordUserByUsername(username)) {
        return res.status(409).json({ error: 'Email or username already exists' });
      }
      const user = createDevPasswordUser({ fullName, email, username, passwordHash });
      setSessionCookie(res, user);
      return res.status(201).json(publicDevUser(user));
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email or username already exists' });
    }
    handleRouteError(res, error);
  }
});

router.post('/login', async (req, res) => {
  try {
    requireFields(req.body, ['email', 'password']);
    const [users] = await db.query(
      'SELECT id, full_name, email, username, password_hash, role, bio, home_city, avatar_url, messages_enabled, activity_visibility FROM users WHERE email = ? AND deleted_at IS NULL',
      [String(req.body.email).toLowerCase()],
    );
    const user = users[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const passwordMatches = await bcrypt.compare(req.body.password, user.password_hash);
    if (!passwordMatches) return res.status(401).json({ error: 'Invalid email or password' });

    await db.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    setSessionCookie(res, user);
    res.json(publicUser(user));
  } catch (error) {
    if (canUseDevAuthFallback(error)) {
      const user = findDevPasswordUserByEmail(req.body.email);
      if (!user) return res.status(401).json({ error: 'Invalid email or password' });
      const passwordMatches = await bcrypt.compare(req.body.password, user.password_hash);
      if (!passwordMatches) return res.status(401).json({ error: 'Invalid email or password' });
      setSessionCookie(res, user);
      return res.json(publicDevUser(user));
    }
    handleRouteError(res, error);
  }
});

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

module.exports = router;
