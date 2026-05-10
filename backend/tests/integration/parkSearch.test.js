const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const createApp = require('../../app');
const config = require('../../config');
const db = require('../../db');

async function request(app, path = '/') {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    return {
      status: response.status,
      body: await response.json(),
    };
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('local fallback search filters parks to the resolved search area', async (t) => {
  const originalKey = config.googlePlacesApiKey;
  const originalFetch = global.fetch;
  const originalQuery = db.query;

  t.after(() => {
    config.googlePlacesApiKey = originalKey;
    global.fetch = originalFetch;
    db.query = originalQuery;
  });

  config.googlePlacesApiKey = 'test-key';
  global.fetch = async (url, options) => {
    const requestUrl = String(url);
    if (requestUrl.startsWith('http://127.0.0.1:')) {
      return originalFetch(url, options);
    }
    if (requestUrl.includes('/places:searchText')) {
      return {
        ok: false,
        status: 503,
        async json() {
          return { error: { message: 'Places unavailable' } };
        },
      };
    }

    assert.match(requestUrl, /\/geocode\/json/);
    return {
      ok: true,
      async json() {
        return {
          status: 'OK',
          results: [
            {
              formatted_address: 'Rogers, AR, USA',
              geometry: { location: { lat: 36.332, lng: -94.1185 } },
            },
          ],
        };
      },
    };
  };
  db.query = async () => [
    [
      {
        id: 'local-near',
        name: 'Rogers Bark Park',
        park_name: 'Rogers Bark Park',
        address: '100 Park Dr',
        city: 'Rogers',
        state: 'AR',
        latitude: 36.34,
        longitude: -94.12,
        is_public: 1,
      },
      {
        id: 'local-far',
        name: 'Memphis Dog Park',
        park_name: 'Memphis Dog Park',
        address: '1 Far Ave',
        city: 'Memphis',
        state: 'TN',
        latitude: 35.1,
        longitude: -90.1,
        is_public: 1,
      },
    ],
  ];

  const response = await request(createApp(), '/api/parks/search?query=Rogers%20Arkansas&limit=18');

  assert.equal(response.status, 200);
  assert.equal(response.body.googleAttributionRequired, false);
  assert.equal(response.body.searchArea.label, 'Rogers, AR');
  assert.deepEqual(
    response.body.results.map((park) => park.id),
    ['local-near'],
  );
  assert.equal(typeof response.body.results[0].distanceMiles, 'number');
});

test('local fallback search degrades cleanly when the development database is unavailable', async (t) => {
  const originalKey = config.googlePlacesApiKey;
  const originalQuery = db.query;
  t.after(() => {
    config.googlePlacesApiKey = originalKey;
    db.query = originalQuery;
  });

  config.googlePlacesApiKey = '';
  db.query = async () => {
    throw new Error('database unavailable');
  };

  const response = await request(createApp(), '/api/parks/search?query=Austin');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.results, []);
  assert.match(response.body.warning, /Google Places is not configured|local database results/);
});
