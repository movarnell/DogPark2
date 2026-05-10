const assert = require('node:assert/strict');
const test = require('node:test');

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
}

function requireFreshConfig() {
  delete require.cache[require.resolve('../../config')];
  return require('../../config');
}

test('production startup rejects a missing or default session secret', (t) => {
  t.after(resetEnv);
  process.env.NODE_ENV = 'production';
  process.env.SESSION_SECRET = '';
  delete process.env.JWT_SECRET;
  process.env.AUTH_DB_FALLBACK = 'false';

  assert.throws(
    () => requireFreshConfig(),
    /SESSION_SECRET must be set to a strong production secret/,
  );
});

test('production startup rejects development auth fallback', (t) => {
  t.after(resetEnv);
  process.env.NODE_ENV = 'production';
  process.env.SESSION_SECRET = 'a-production-session-secret-that-is-long-enough';
  process.env.AUTH_DB_FALLBACK = 'true';

  assert.throws(
    () => requireFreshConfig(),
    /AUTH_DB_FALLBACK must not be enabled in production/,
  );
});
