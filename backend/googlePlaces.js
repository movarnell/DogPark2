const config = require('./config');

const GOOGLE_PLACES_BASE_URL = 'https://places.googleapis.com/v1';
const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const PLACE_CACHE_TTL_MS = 1000 * 60 * 30;
const DEFAULT_LOCAL_SEARCH_RADIUS_METERS = 80467;
const METERS_PER_MILE = 1609.344;
const EARTH_RADIUS_METERS = 6371000;
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

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampRadiusMeters(radius) {
  const requested = toFiniteNumber(radius) || DEFAULT_LOCAL_SEARCH_RADIUS_METERS;
  return Math.min(Math.max(requested, 1000), DEFAULT_LOCAL_SEARCH_RADIUS_METERS);
}

function cleanLocationQuery(value = '') {
  return String(value)
    .replace(/\bdog\s+parks?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isVagueLocationQuery(value) {
  return /^(near\s+me|nearby|around\s+me|my\s+area)$/i.test(String(value || '').trim());
}

function buildTextQuery(query, searchArea) {
  if (searchArea) return 'dog parks';
  const text = String(query.query || query.location || '').trim();
  if (!text) return 'dog parks in the United States';
  return /\bdog\s+parks?\b/i.test(text) ? text : `${text} dog parks`;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function toDegrees(value) {
  return (value * 180) / Math.PI;
}

function distanceMeters(first, second) {
  if (!first || !second) return null;
  const firstLat = toFiniteNumber(first.latitude);
  const firstLng = toFiniteNumber(first.longitude);
  const secondLat = toFiniteNumber(second.latitude);
  const secondLng = toFiniteNumber(second.longitude);
  if (firstLat === null || firstLng === null || secondLat === null || secondLng === null) return null;

  const deltaLat = toRadians(secondLat - firstLat);
  const deltaLng = toRadians(secondLng - firstLng);
  const startLat = toRadians(firstLat);
  const endLat = toRadians(secondLat);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

function buildViewport(center, radiusMeters) {
  const lat = toFiniteNumber(center.latitude);
  const lng = toFiniteNumber(center.longitude);
  if (lat === null || lng === null) return null;

  const angularDistance = radiusMeters / EARTH_RADIUS_METERS;
  const deltaLat = toDegrees(angularDistance);
  const latitudeCos = Math.cos(toRadians(lat));
  const deltaLng = latitudeCos === 0 ? 180 : Math.min(180, toDegrees(angularDistance / latitudeCos));

  return {
    low: {
      latitude: Math.max(-90, lat - deltaLat),
      longitude: Math.max(-180, lng - deltaLng),
    },
    high: {
      latitude: Math.min(90, lat + deltaLat),
      longitude: Math.min(180, lng + deltaLng),
    },
  };
}

function searchAreaResponse(searchArea) {
  if (!searchArea) return null;
  return {
    label: searchArea.label,
    latitude: searchArea.center.latitude,
    longitude: searchArea.center.longitude,
    radiusMeters: searchArea.radiusMeters,
    radiusMiles: Math.round((searchArea.radiusMeters / METERS_PER_MILE) * 10) / 10,
  };
}

async function resolveSearchArea(query) {
  const lat = toFiniteNumber(query.lat);
  const lng = toFiniteNumber(query.lng);
  const radiusMeters = clampRadiusMeters(query.radius);

  if (lat !== null && lng !== null) {
    return {
      searchArea: {
        label: query.location || query.query || 'your location',
        center: { latitude: lat, longitude: lng },
        radiusMeters,
        source: 'coordinates',
      },
      warning: '',
    };
  }

  const locationQuery = cleanLocationQuery(query.location || query.query);
  if (isVagueLocationQuery(locationQuery)) return { searchArea: null, warning: '' };
  if (!locationQuery || query.pageToken) return { searchArea: null, warning: '' };

  assertGoogleConfigured();

  const params = new URLSearchParams({
    address: locationQuery,
    components: 'country:US',
    key: config.googlePlacesApiKey,
  });
  const response = await fetch(`${GOOGLE_GEOCODING_URL}?${params}`);
  const data = await response.json();

  if (!response.ok || data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
    return {
      searchArea: null,
      warning: 'Search area could not be resolved; showing best text matches.',
    };
  }

  const result = data.results[0];
  const formattedAddress = String(result.formatted_address || locationQuery).replace(/,\s*USA$/i, '');
  return {
    searchArea: {
      label: formattedAddress,
      center: {
        latitude: Number(result.geometry.location.lat),
        longitude: Number(result.geometry.location.lng),
      },
      radiusMeters,
      source: 'geocoded_query',
    },
    warning: '',
  };
}

function applySearchArea(results, searchArea) {
  if (!searchArea) return results;
  return results
    .map((place) => {
      const distance = distanceMeters(searchArea.center, {
        latitude: place.latitude,
        longitude: place.longitude,
      });
      if (distance === null) return null;
      return {
        ...place,
        distanceMeters: Math.round(distance),
        distanceMiles: Math.round((distance / METERS_PER_MILE) * 10) / 10,
      };
    })
    .filter((place) => place && place.distanceMeters <= searchArea.radiusMeters)
    .sort((first, second) => {
      if (first.distanceMeters !== second.distanceMeters) return first.distanceMeters - second.distanceMeters;
      return (second.rating || 0) - (first.rating || 0);
    });
}

function buildSearchBody(query, searchArea) {
  const textQuery = buildTextQuery(query, searchArea);
  const body = {
    textQuery,
    includedType: 'dog_park',
    strictTypeFiltering: true,
    pageSize: Math.min(Number(query.limit || 12), 20),
    languageCode: 'en',
    regionCode: 'US',
  };

  if (searchArea) {
    const viewport = buildViewport(searchArea.center, searchArea.radiusMeters);
    if (viewport) {
      body.locationRestriction = {
        rectangle: viewport,
      };
    }
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
  const { searchArea, warning } = await resolveSearchArea(query);

  const response = await fetch(`${GOOGLE_PLACES_BASE_URL}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': config.googlePlacesApiKey,
      'X-Goog-FieldMask': TEXT_SEARCH_FIELDS,
    },
    body: JSON.stringify(buildSearchBody(query, searchArea)),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Google Places search failed');
    error.statusCode = response.status;
    throw error;
  }

  const results = applySearchArea(
    (data.places || []).map(mapGooglePlace).map((place) => cachePlace(place, 'summary')),
    searchArea,
  );
  return {
    results,
    nextPageToken: data.nextPageToken || null,
    searchArea: searchAreaResponse(searchArea),
    warning,
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
  resolveSearchArea,
  applySearchArea,
  distanceMeters,
  buildSearchBody,
  searchAreaResponse,
  DEFAULT_LOCAL_SEARCH_RADIUS_METERS,
};
