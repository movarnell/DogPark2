const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const createApp = require('../../app');
const { createSessionToken } = require('../../auth');
const db = require('../../db');
const { createDevDog, createDevPasswordUser, createDevVisit } = require('../../devAuthFallback');

async function request(app, { method = 'GET', path = '/', headers = {}, body } = {}) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : null,
    };
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

function cookieFor(user) {
  return `dogpark_session=${encodeURIComponent(createSessionToken(user))}`;
}

test('admin routes recheck the database role instead of trusting cookie claims', async (t) => {
  const originalQuery = db.query;
  t.after(() => {
    db.query = originalQuery;
  });

  db.query = async (sql) => {
    if (String(sql).includes('SELECT role FROM users')) return [[{ role: 'member' }]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const response = await request(createApp(), {
    path: '/api/admin/reports',
    headers: {
      Cookie: cookieFor({
        id: 42,
        email: 'owner@example.com',
        username: 'owner',
        role: 'admin',
      }),
    },
  });

  assert.equal(response.status, 403);
});

test('deleted or demoted users cannot keep admin access with an old cookie', async (t) => {
  const originalQuery = db.query;
  t.after(() => {
    db.query = originalQuery;
  });

  db.query = async (sql) => {
    if (String(sql).includes('SELECT role FROM users')) return [[]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const response = await request(createApp(), {
    path: '/api/admin/reports',
    headers: {
      Cookie: cookieFor({
        id: 42,
        email: 'owner@example.com',
        username: 'owner',
        role: 'admin',
      }),
    },
  });

  assert.equal(response.status, 403);
});

test('non-admin users cannot list owner emails and roles', async (t) => {
  const originalQuery = db.query;
  t.after(() => {
    db.query = originalQuery;
  });

  db.query = async (sql) => {
    if (String(sql).includes('SELECT role FROM users')) return [[{ role: 'member' }]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const response = await request(createApp(), {
    path: '/api/owners',
    headers: {
      Cookie: cookieFor({
        id: 42,
        email: 'owner@example.com',
        username: 'owner',
        role: 'member',
      }),
    },
  });

  assert.equal(response.status, 403);
});

test('visit creation rejects dog ids that do not belong to the signed-in user', async (t) => {
  const originalQuery = db.query;
  t.after(() => {
    db.query = originalQuery;
  });

  db.query = async (sql) => {
    if (String(sql).includes('SELECT id FROM dogs')) return [[]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const response = await request(createApp(), {
    method: 'POST',
    path: '/api/visits',
    headers: {
      Cookie: cookieFor({
        id: 42,
        email: 'owner@example.com',
        username: 'owner',
        role: 'member',
      }),
    },
    body: {
      parkId: 'park-1',
      dogId: 'other-owner-dog',
      startsAt: '2099-05-08T10:00:00.000Z',
    },
  });

  assert.equal(response.status, 403);
});

test('visit creation still allows a dog owned by the signed-in user', async (t) => {
  const originalQuery = db.query;
  t.after(() => {
    db.query = originalQuery;
  });

  db.query = async (sql) => {
    const query = String(sql);
    if (query.includes('SELECT id FROM dogs')) return [[{ id: 'dog-1' }]];
    if (query.includes('INSERT INTO visits')) return [{ affectedRows: 1 }];
    if (query.includes('SELECT CASE WHEN requester_user_id')) return [[]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const response = await request(createApp(), {
    method: 'POST',
    path: '/api/visits',
    headers: {
      Cookie: cookieFor({
        id: 42,
        email: 'owner@example.com',
        username: 'owner',
        role: 'member',
      }),
    },
    body: {
      parkId: 'park-1',
      dogId: 'dog-1',
      startsAt: '2099-05-08T10:00:00.000Z',
    },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.status, 'planned');
});

test('dog creation rejects invalid compatibility traits', async () => {
  const user = createDevPasswordUser({
    fullName: 'Trait Owner',
    email: 'trait-owner@example.com',
    username: 'trait_owner',
    passwordHash: 'hash',
  });

  const response = await request(createApp(), {
    method: 'POST',
    path: '/api/dogs',
    headers: {
      Cookie: cookieFor(user),
    },
    body: {
      name: 'Maple',
      size: 'medium',
      playStyle: 'chaotic',
    },
  });

  assert.equal(response.status, 400);
});

test('visits include compatibility only for a viewer dog owned by the signed-in user', async () => {
  const owner = createDevPasswordUser({
    fullName: 'Viewer Owner',
    email: 'viewer-owner@example.com',
    username: 'viewer_owner',
    passwordHash: 'hash',
  });
  const other = createDevPasswordUser({
    fullName: 'Visit Owner',
    email: 'visit-owner@example.com',
    username: 'visit_owner',
    passwordHash: 'hash',
  });
  const viewerDog = createDevDog(owner.id, {
    name: 'Maple',
    size: 'medium',
    breed: 'Retriever mix',
    energyLevel: 'high',
    playStyle: 'balanced',
    socialComfort: 'social',
    preferredDogSizes: ['medium'],
  });
  const otherDog = createDevDog(other.id, {
    name: 'Pepper',
    size: 'medium',
    breed: 'Retriever mix',
    energyLevel: 'high',
    playStyle: 'balanced',
    socialComfort: 'social',
    preferredDogSizes: ['medium'],
  });
  createDevVisit(other, {
    parkId: 'compatibility-route-park',
    dogId: otherDog.id,
    startsAt: '2099-05-08T10:00:00.000Z',
  });

  const withoutDog = await request(createApp(), {
    path: '/api/visits?parkId=compatibility-route-park',
    headers: { Cookie: cookieFor(owner) },
  });
  assert.equal(withoutDog.status, 200);
  assert.equal(withoutDog.body[0].compatibility, undefined);

  const withDog = await request(createApp(), {
    path: `/api/visits?parkId=compatibility-route-park&viewerDogId=${encodeURIComponent(viewerDog.id)}`,
    headers: { Cookie: cookieFor(owner) },
  });
  assert.equal(withDog.status, 200);
  assert.equal(withDog.body[0].compatibility.tier, 'best');
});
