const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const createApp = require('../../app');
const db = require('../../db');

async function request(app, { path = '/' } = {}) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
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

test('health reports API and database readiness without leaking secrets', async (t) => {
  const originalQuery = db.query;
  t.after(() => {
    db.query = originalQuery;
  });

  db.query = async (sql) => {
    assert.equal(sql, 'SELECT 1');
    return [[{ '1': 1 }]];
  };

  const response = await request(createApp(), { path: '/health' });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.checks.api.ok, true);
  assert.equal(response.body.checks.database.ok, true);
  assert.equal(typeof response.body.checks.googlePlaces.configured, 'boolean');
  assert.equal(JSON.stringify(response.body).includes('sessionSecret'), false);
});

test('health returns 503 when the database is unreachable', async (t) => {
  const originalQuery = db.query;
  t.after(() => {
    db.query = originalQuery;
  });

  db.query = async () => {
    throw new Error('connection refused');
  };

  const response = await request(createApp(), { path: '/health' });

  assert.equal(response.status, 503);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.checks.api.ok, true);
  assert.equal(response.body.checks.database.ok, false);
});
