const crypto = require('crypto');
const config = require('./config');
const db = require('./db');

const COOKIE_NAME = 'dogpark_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('base64url');
}

function appendSetCookie(res, cookieValue) {
  const current = res.getHeader('Set-Cookie');
  if (!current) {
    res.setHeader('Set-Cookie', cookieValue);
    return;
  }
  res.setHeader('Set-Cookie', Array.isArray(current) ? [...current, cookieValue] : [current, cookieValue]);
}

function createSessionToken(user) {
  const payload = {
    sub: String(user.id),
    email: user.email,
    username: user.username,
    role: user.role || 'member',
    fullName: user.fullName || user.full_name || user.human_name || user.username || '',
    avatarUrl: user.avatarUrl || user.avatar_url || '',
    devAuthFallback: Boolean(user.devAuthFallback),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encodedPayload = base64url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifySessionToken(token) {
  if (!token || !token.includes('.')) return null;
  const [encodedPayload, signature] = token.split('.');
  const expected = sign(encodedPayload);
  const actual = Buffer.from(signature || '');
  const expectedBuffer = Buffer.from(expected);

  if (actual.length !== expectedBuffer.length || !crypto.timingSafeEqual(actual, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((cookies, part) => {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey) return cookies;
    cookies[rawKey] = decodeURIComponent(rawValue.join('='));
    return cookies;
  }, {});
}

function setSessionCookie(res, user) {
  const token = createSessionToken(user);
  const attributes = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (config.cookieSecure) attributes.push('Secure');
  appendSetCookie(res, attributes.join('; '));
}

function clearSessionCookie(res) {
  appendSetCookie(
    res,
    `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${config.cookieSecure ? '; Secure' : ''}`,
  );
}

function optionalAuth(req, _res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const payload = verifySessionToken(cookies[COOKIE_NAME]);
  req.user = payload
    ? {
        id: payload.sub,
        email: payload.email,
        username: payload.username,
        role: payload.role || 'member',
        fullName: payload.fullName || '',
        avatarUrl: payload.avatarUrl || '',
        devAuthFallback: Boolean(payload.devAuthFallback),
      }
    : null;
  next();
}

function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  });
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    Promise.resolve()
      .then(async () => {
        if (req.user.devAuthFallback || String(req.user.id).startsWith('dev-')) {
          return res.status(403).json({ error: 'Admin access required' });
        }

        const [users] = await db.query(
          'SELECT role FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
          [req.user.id],
        );
        if (users[0]?.role !== 'admin') {
          return res.status(403).json({ error: 'Admin access required' });
        }

        req.user.role = users[0].role;
        next();
      })
      .catch(next);
  });
}

module.exports = {
  COOKIE_NAME,
  clearSessionCookie,
  createSessionToken,
  optionalAuth,
  parseCookies,
  requireAdmin,
  requireAuth,
  setSessionCookie,
  verifySessionToken,
};
