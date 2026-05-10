const assert = require('node:assert/strict');
const test = require('node:test');
const { createSessionToken, verifySessionToken } = require('../../auth');

test('signed session tokens round-trip public user payload', () => {
  const token = createSessionToken({
    id: 42,
    email: 'owner@example.com',
    username: 'owner',
    role: 'admin',
  });
  const payload = verifySessionToken(token);

  assert.equal(payload.sub, '42');
  assert.equal(payload.email, 'owner@example.com');
  assert.equal(payload.username, 'owner');
  assert.equal(payload.role, 'admin');
  assert.equal(payload.fullName, 'owner');
  assert.equal(payload.avatarUrl, '');
});

test('tampered session tokens are rejected', () => {
  const token = createSessionToken({
    id: 42,
    email: 'owner@example.com',
    username: 'owner',
  });
  const [payload, signature] = token.split('.');
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  parsed.username = 'other';
  const tamperedPayload = Buffer.from(JSON.stringify(parsed)).toString('base64url');
  const tamperedToken = `${tamperedPayload}.${signature}`;

  assert.equal(verifySessionToken(tamperedToken), null);
});
