const assert = require('node:assert/strict');
const test = require('node:test');
const config = require('../../config');
const { mapGooglePlace, searchDogParks } = require('../../googlePlaces');

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
