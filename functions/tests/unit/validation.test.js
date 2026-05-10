const assert = require('node:assert/strict');
const test = require('node:test');
const {
  isEmail,
  normalizeBoolean,
  normalizeOptionalUrl,
  requireFields,
  toOptionalJson,
} = require('../../validation');

test('requireFields reports missing required values', () => {
  assert.throws(
    () => requireFields({ email: '', username: 'owner' }, ['email', 'username']),
    /Missing required fields: email/,
  );
});

test('isEmail accepts ordinary emails and rejects malformed values', () => {
  assert.equal(isEmail('owner@example.com'), true);
  assert.equal(isEmail('owner@example'), false);
  assert.equal(isEmail(''), false);
});

test('normalizeBoolean accepts boolean-like database and form values', () => {
  assert.equal(normalizeBoolean(true), true);
  assert.equal(normalizeBoolean(1), true);
  assert.equal(normalizeBoolean('true'), true);
  assert.equal(normalizeBoolean(false), false);
  assert.equal(normalizeBoolean(0), false);
  assert.equal(normalizeBoolean('false'), false);
});

test('toOptionalJson parses JSON strings and falls back for empty or invalid values', () => {
  assert.deepEqual(toOptionalJson('["small","medium"]'), ['small', 'medium']);
  assert.deepEqual(toOptionalJson(['large']), ['large']);
  assert.deepEqual(toOptionalJson('', []), []);
  assert.equal(toOptionalJson('not-json', null), null);
});

test('normalizeOptionalUrl only accepts http and https URLs', () => {
  assert.equal(normalizeOptionalUrl('https://example.com/dog.png'), 'https://example.com/dog.png');
  assert.equal(normalizeOptionalUrl('', 'Avatar URL'), null);
  assert.throws(() => normalizeOptionalUrl('ftp://example.com/dog.png', 'Avatar URL'), /Avatar URL must use http or https/);
  assert.throws(() => normalizeOptionalUrl('not a url', 'Avatar URL'), /Avatar URL must be a valid URL/);
});
