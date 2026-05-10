const config = require('./config');

const GOOGLE_PLACES_BASE_URL = 'https://places.googleapis.com/v1';
const PLACE_CACHE_TTL_MS = 1000 * 60 * 30;
const placeCache = new Map();
const TEXT_SEARCH_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryType',
  'places.types',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.photos',
  'places.attributions',
  'nextPageToken',
].join(',');

const DETAILS_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'primaryType',
  'types',
  'rating',
  'userRatingCount',
  'photos',
  'googleMapsUri',
  'websiteUri',
  'regularOpeningHours',
  'nationalPhoneNumber',
  'accessibilityOptions',
  'allowsDogs',
  'restroom',
  'parkingOptions',
  'attributions',
].join(',');

function assertGoogleConfigured() {
  if (!config.googlePlacesApiKey) {
    const error = new Error('Google Places API key is not configured');
    error.statusCode = 503;
    throw error;
  }
}

function buildSearchBody(query) {
  const textQuery = query.query || query.location || 'dog parks in the United States';
  const body = {
    textQuery,
    includedType: 'dog_park',
    strictTypeFiltering: true,
    pageSize: Math.min(Number(query.limit || 12), 20),
    languageCode: 'en',
    regionCode: 'US',
  };

  if (query.lat && query.lng) {
    body.locationBias = {
      circle: {
        center: {
          latitude: Number(query.lat),
          longitude: Number(query.lng),
        },
        radius: Math.min(Number(query.radius || 40000), 50000),
      },
    };
  }

  if (query.pageToken) {
    body.pageToken = query.pageToken;
  }

  return body;
}

function mapPhoto(photo) {
  if (!photo?.name) return null;
  return {
    name: photo.name,
    widthPx: photo.widthPx,
    heightPx: photo.heightPx,
    authorAttributions: photo.authorAttributions || [],
  };
}

function mapGooglePlace(place) {
  const photos = (place.photos || []).map(mapPhoto).filter(Boolean);
  return {
    source: 'google',
    googlePlaceId: place.id,
    name: place.displayName?.text || 'Unnamed dog park',
    address: place.formattedAddress || '',
    latitude: place.location?.latitude || null,
    longitude: place.location?.longitude || null,
    primaryType: place.primaryType || '',
    types: place.types || [],
    rating: place.rating || null,
    userRatingCount: place.userRatingCount || 0,
    googleMapsUri: place.googleMapsUri || '',
    websiteUri: place.websiteUri || '',
    phoneNumber: place.nationalPhoneNumber || '',
    openingHours: place.regularOpeningHours?.weekdayDescriptions || [],
    photos,
    photoUrl: photos[0]?.name
      ? `/api/parks/photos?name=${encodeURIComponent(photos[0].name)}&maxWidth=900`
      : '',
    attributions: place.attributions || [],
    accessibilityOptions: place.accessibilityOptions || null,
    allowsDogs: place.allowsDogs ?? null,
    restroom: place.restroom ?? null,
    parkingOptions: place.parkingOptions || null,
  };
}

function cachePlace(place, detailLevel = 'summary') {
  if (!place?.googlePlaceId) return place;
  const existing = placeCache.get(place.googlePlaceId)?.place || {};
  const merged = { ...existing, ...place, detailLevel };
  placeCache.set(place.googlePlaceId, {
    place: merged,
    expiresAt: Date.now() + PLACE_CACHE_TTL_MS,
  });
  return merged;
}

function getCachedPlace(placeId) {
  const cached = placeCache.get(placeId);
  if (!cached || cached.expiresAt < Date.now()) {
    placeCache.delete(placeId);
    return null;
  }
  return cached.place;
}

function minimalGooglePlace(placeId, warning = '') {
  return {
    source: 'google',
    googlePlaceId: placeId,
    name: 'Dog park',
    address: '',
    latitude: null,
    longitude: null,
    primaryType: 'dog_park',
    types: ['dog_park'],
    rating: null,
    userRatingCount: 0,
    googleMapsUri: `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`,
    websiteUri: '',
    phoneNumber: '',
    openingHours: [],
    photos: [],
    photoUrl: '',
    attributions: [],
    googleDetailsWarning: warning,
  };
}

async function searchDogParks(query) {
  assertGoogleConfigured();

  const response = await fetch(`${GOOGLE_PLACES_BASE_URL}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': config.googlePlacesApiKey,
      'X-Goog-FieldMask': TEXT_SEARCH_FIELDS,
    },
    body: JSON.stringify(buildSearchBody(query)),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Google Places search failed');
    error.statusCode = response.status;
    throw error;
  }

  const results = (data.places || []).map(mapGooglePlace).map((place) => cachePlace(place, 'summary'));
  return {
    results,
    nextPageToken: data.nextPageToken || null,
  };
}

async function fetchPlaceDetails(placeId) {
  assertGoogleConfigured();

  const response = await fetch(`${GOOGLE_PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': config.googlePlacesApiKey,
      'X-Goog-FieldMask': DETAILS_FIELDS,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Google Places details lookup failed');
    error.statusCode = response.status;
    throw error;
  }

  return mapGooglePlace(data);
}

async function refreshPlaceDetails(placeId) {
  const place = await fetchPlaceDetails(placeId);
  return cachePlace(place, 'details');
}

async function getPlaceDetails(placeId, options = {}) {
  const cached = getCachedPlace(placeId);
  if (cached && options.preferCache) {
    refreshPlaceDetails(placeId).catch(() => {});
    return { ...cached, googleDetailsSource: 'cache' };
  }

  try {
    const detailPromise = refreshPlaceDetails(placeId);
    const place = options.timeoutMs
      ? await Promise.race([
          detailPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Google Places details lookup timed out')), options.timeoutMs),
          ),
        ])
      : await detailPromise;
    return { ...place, googleDetailsSource: 'live' };
  } catch (error) {
    if (cached && options.allowCachedFallback !== false) {
      return {
        ...cached,
        googleDetailsSource: 'cache',
        googleDetailsWarning: 'Google place details were slow, so cached place data is being shown.',
      };
    }
    if (options.allowMinimalFallback) {
      return minimalGooglePlace(placeId, 'Google place details are still loading. Community schedules are available.');
    }
    throw error;
  }
}

async function fetchPhoto(photoName, maxWidth = 900) {
  assertGoogleConfigured();

  const safeMaxWidth = Math.min(Math.max(Number(maxWidth) || 900, 120), 1600);
  const url = `${GOOGLE_PLACES_BASE_URL}/${photoName}/media?maxWidthPx=${safeMaxWidth}&skipHttpRedirect=true&key=${config.googlePlacesApiKey}`;
  const metadataResponse = await fetch(url);
  const metadata = await metadataResponse.json();

  if (!metadataResponse.ok || !metadata.photoUri) {
    const error = new Error(metadata.error?.message || 'Google Places photo lookup failed');
    error.statusCode = metadataResponse.status || 502;
    throw error;
  }

  const photoResponse = await fetch(metadata.photoUri);
  if (!photoResponse.ok) {
    const error = new Error('Google Places photo fetch failed');
    error.statusCode = photoResponse.status;
    throw error;
  }

  const contentType = photoResponse.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await photoResponse.arrayBuffer());
  return { buffer, contentType };
}

module.exports = {
  getPlaceDetails,
  searchDogParks,
  fetchPhoto,
  mapGooglePlace,
  getCachedPlace,
};
