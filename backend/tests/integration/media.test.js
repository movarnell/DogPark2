const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const createApp = require('../../app');
const { createSessionToken } = require('../../auth');
const db = require('../../db');

async function request(app, { method = 'GET', path = '/', headers = {}, body } = {}) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers,
      body,
    });
    const contentType = response.headers.get('content-type') || '';
    const responseBody = contentType.startsWith('application/json')
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      headers: response.headers,
      body: responseBody,
    };
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

function cookieFor(user) {
  return `dogpark_session=${encodeURIComponent(createSessionToken(user))}`;
}

test('media upload stores image bytes and returns a stable media URL', async (t) => {
  const originalQuery = db.query;
  const stored = new Map();
  t.after(() => {
    db.query = originalQuery;
  });

  db.query = async (sql, params) => {
    const query = String(sql);
    if (query.includes('INSERT INTO media_assets')) {
      stored.set(params[0], {
        mime_type: params[3],
        byte_size: params[4],
        data: params[5],
      });
      return [{ affectedRows: 1 }];
    }
    if (query.includes('SELECT mime_type, byte_size, data FROM media_assets')) {
      return [[stored.get(params[0])].filter(Boolean)];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const upload = await request(createApp(), {
    method: 'POST',
    path: '/api/media?purpose=dog_photo',
    headers: {
      Cookie: cookieFor({ id: 42, email: 'owner@example.com', username: 'owner', role: 'member' }),
      'Content-Type': 'image/png',
    },
    body: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  });

  assert.equal(upload.status, 201);
  assert.match(upload.body.url, /^\/api\/media\/[0-9a-f-]{36}$/);

  const download = await request(createApp(), { path: upload.body.url });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('content-type'), 'image/png');
  assert.deepEqual([...download.body], [0x89, 0x50, 0x4e, 0x47]);
});

test('media upload rejects unsupported content types', async () => {
  const response = await request(createApp(), {
    method: 'POST',
    path: '/api/media',
    headers: {
      Cookie: cookieFor({ id: 42, email: 'owner@example.com', username: 'owner', role: 'member' }),
      'Content-Type': 'text/plain',
    },
    body: Buffer.from('not an image'),
  });

  assert.equal(response.status, 415);
});

test('media upload rejects images over three megabytes', async () => {
  const response = await request(createApp(), {
    method: 'POST',
    path: '/api/media',
    headers: {
      Cookie: cookieFor({ id: 42, email: 'owner@example.com', username: 'owner', role: 'member' }),
      'Content-Type': 'image/jpeg',
    },
    body: Buffer.alloc(3 * 1024 * 1024 + 1),
  });

  assert.equal(response.status, 413);
});
