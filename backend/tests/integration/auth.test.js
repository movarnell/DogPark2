const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');
const config = require('../../config');
const { createSessionToken, verifySessionToken } = require('../../auth');
const ownersRouter = require('../../owners');

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

async function withOwnersServer(callback) {
  const app = express();
  app.use(express.json());
  app.use('/api/owners', ownersRouter);
  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
  });
  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('native Apple auth reports missing configuration as an API error', async () => {
  const original = {
    clientId: config.appleOAuthClientId,
    teamId: config.appleOAuthTeamId,
    keyId: config.appleOAuthKeyId,
    privateKey: config.appleOAuthPrivateKey,
    redirectUri: config.appleOAuthRedirectUri,
  };
  config.appleOAuthClientId = '';
  config.appleOAuthTeamId = '';
  config.appleOAuthKeyId = '';
  config.appleOAuthPrivateKey = '';
  config.appleOAuthRedirectUri = '';

  await withOwnersServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/owners/apple/native`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identityToken: 'not-a-jwt' }),
    });
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.match(body.error, /not configured/);
  });

  Object.assign(config, {
    appleOAuthClientId: original.clientId,
    appleOAuthTeamId: original.teamId,
    appleOAuthKeyId: original.keyId,
    appleOAuthPrivateKey: original.privateKey,
    appleOAuthRedirectUri: original.redirectUri,
  });
});

test('native Google auth reports missing configuration as an API error', async () => {
  const original = {
    webClientId: config.googleOAuthClientId,
    iosClientId: config.googleIOSClientId,
  };
  config.googleOAuthClientId = '';
  config.googleIOSClientId = '';

  await withOwnersServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/owners/google/native`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identityToken: 'not-a-jwt' }),
    });
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.match(body.error, /not configured/);
  });

  Object.assign(config, {
    googleOAuthClientId: original.webClientId,
    googleIOSClientId: original.iosClientId,
  });
});

test('native Google auth rejects malformed identity tokens before creating a session', async () => {
  const original = {
    webClientId: config.googleOAuthClientId,
    iosClientId: config.googleIOSClientId,
  };
  config.googleOAuthClientId = '';
  config.googleIOSClientId = 'ios-client-id.apps.googleusercontent.com';

  await withOwnersServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/owners/google/native`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identityToken: 'not-a-jwt' }),
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.match(body.error, /identity token was invalid/);
    assert.equal(response.headers.get('set-cookie'), null);
  });

  Object.assign(config, {
    googleOAuthClientId: original.webClientId,
    googleIOSClientId: original.iosClientId,
  });
});

test('native Apple auth rejects malformed identity tokens before creating a session', async () => {
  const original = {
    clientId: config.appleOAuthClientId,
    teamId: config.appleOAuthTeamId,
    keyId: config.appleOAuthKeyId,
    privateKey: config.appleOAuthPrivateKey,
    redirectUri: config.appleOAuthRedirectUri,
  };
  Object.assign(config, {
    appleOAuthClientId: 'com.example.dogpark',
    appleOAuthTeamId: 'TEAMID1234',
    appleOAuthKeyId: 'KEYID1234',
    appleOAuthPrivateKey: 'fake-private-key',
    appleOAuthRedirectUri: 'https://api.example.com/api/owners/apple/callback',
  });

  await withOwnersServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/owners/apple/native`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identityToken: 'not-a-jwt' }),
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.match(body.error, /identity token was invalid/);
    assert.equal(response.headers.get('set-cookie'), null);
  });

  Object.assign(config, {
    appleOAuthClientId: original.clientId,
    appleOAuthTeamId: original.teamId,
    appleOAuthKeyId: original.keyId,
    appleOAuthPrivateKey: original.privateKey,
    appleOAuthRedirectUri: original.redirectUri,
  });
});
