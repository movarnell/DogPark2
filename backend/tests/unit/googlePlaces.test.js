const assert = require('node:assert/strict');
const test = require('node:test');
const config = require('../../config');
const { applySearchArea, buildSearchBody, mapGooglePlace, searchDogParks } = require('../../googlePlaces');

test('maps Google Places responses to frontend park cards', () => {
  const park = mapGooglePlace({
    id: 'abc123',
    displayName: { text: 'Central Dog Run' },
    formattedAddress: '1 Park Ave, New York, NY',
    location: { latitude: 40.1, longitude: -73.9 },
    primaryType: 'dog_park',
    types: ['dog_park', 'park'],
    rating: 4.7,
    userRatingCount: 55,
    googleMapsUri: 'https://maps.google.com/example',
    photos: [{ name: 'places/abc/photos/photo1', widthPx: 800, heightPx: 600 }],
    attributions: [{ provider: 'Google' }],
  });

  assert.equal(park.source, 'google');
  assert.equal(park.googlePlaceId, 'abc123');
  assert.equal(park.name, 'Central Dog Run');
  assert.equal(park.latitude, 40.1);
  assert.equal(park.photos.length, 1);
  assert.match(park.photoUrl, /\/api\/parks\/photos/);
});

test('requests Google photos during text search so park cards can render images', async (t) => {
  config.googlePlacesApiKey = 'test-key';

  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (_url, options) => {
    assert.match(options.headers['X-Goog-FieldMask'], /places\.photos/);

    return {
      ok: true,
      async json() {
        return {
          places: [
            {
              id: 'abc123',
              displayName: { text: 'Central Dog Run' },
              photos: [{ name: 'places/abc/photos/photo1', widthPx: 800, heightPx: 600 }],
            },
          ],
        };
      },
    };
  };

  const data = await searchDogParks({ query: 'dog parks near me' });

  assert.equal(data.results[0].photos.length, 1);
  assert.match(data.results[0].photoUrl, /\/api\/parks\/photos/);
});

test('typed location searches use a restricted local search area', async (t) => {
  config.googlePlacesApiKey = 'test-key';

  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url, options) => {
    if (String(url).includes('/geocode/json')) {
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
    }

    const body = JSON.parse(options.body);
    assert.equal(body.textQuery, 'dog parks');
    assert.ok(body.locationRestriction);
    assert.equal(body.locationBias, undefined);

    return {
      ok: true,
      async json() {
        return {
          places: [
            {
              id: 'near',
              displayName: { text: 'Rogers Bark Park' },
              location: { latitude: 36.34, longitude: -94.12 },
              photos: [{ name: 'places/near/photos/photo1', widthPx: 800, heightPx: 600 }],
            },
            {
              id: 'far',
              displayName: { text: 'Far Away Dog Park' },
              location: { latitude: 35.1, longitude: -90.1 },
            },
          ],
        };
      },
    };
  };

  const data = await searchDogParks({ query: 'Rogers Arkansas', limit: '18' });

  assert.equal(data.searchArea.label, 'Rogers, AR');
  assert.equal(data.searchArea.radiusMeters, 80467);
  assert.equal(data.results.length, 1);
  assert.equal(data.results[0].googlePlaceId, 'near');
  assert.equal(typeof data.results[0].distanceMiles, 'number');
});

test('coordinate searches are capped and distance filtered', () => {
  const body = buildSearchBody(
    { lat: '36.332', lng: '-94.1185', radius: '200000' },
    {
      center: { latitude: 36.332, longitude: -94.1185 },
      radiusMeters: 80467,
    },
  );

  assert.ok(body.locationRestriction);
  assert.equal(body.textQuery, 'dog parks');

  const results = applySearchArea(
    [
      { googlePlaceId: 'near', latitude: 36.34, longitude: -94.12, rating: 4 },
      { googlePlaceId: 'far', latitude: 35.1, longitude: -90.1, rating: 5 },
    ],
    {
      center: { latitude: 36.332, longitude: -94.1185 },
      radiusMeters: 80467,
    },
  );

  assert.deepEqual(
    results.map((result) => result.googlePlaceId),
    ['near'],
  );
  assert.equal(typeof results[0].distanceMiles, 'number');
});

test('explicit location parameter drives area resolution for generic dog park queries', async (t) => {
  config.googlePlacesApiKey = 'test-key';

  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url, options) => {
    if (String(url).includes('/geocode/json')) {
      assert.match(String(url), /address=Madison%2C\+WI/);
      return {
        ok: true,
        async json() {
          return {
            status: 'OK',
            results: [
              {
                formatted_address: 'Madison, WI, USA',
                geometry: { location: { lat: 43.0731, lng: -89.4012 } },
              },
            ],
          };
        },
      };
    }

    const body = JSON.parse(options.body);
    assert.equal(body.textQuery, 'dog parks');
    assert.ok(body.locationRestriction);

    return {
      ok: true,
      async json() {
        return {
          places: [
            {
              id: 'madison-park',
              displayName: { text: 'Madison Dog Park' },
              location: { latitude: 43.08, longitude: -89.4 },
            },
          ],
        };
      },
    };
  };

  const data = await searchDogParks({ query: 'dog parks', location: 'Madison, WI', limit: '12' });

  assert.equal(data.searchArea.label, 'Madison, WI');
  assert.equal(data.results[0].googlePlaceId, 'madison-park');
});
