const crypto = require('crypto');
const express = require('express');
const config = require('./config');
const db = require('./db');
const { optionalAuth, requireAuth } = require('./auth');
const { isDevAuthUserId, listDevVisits } = require('./devAuthFallback');
const { fetchPhoto, getPlaceDetails, searchDogParks } = require('./googlePlaces');
const { handleRouteError, normalizeOptionalUrl, requireFields, toOptionalJson } = require('./validation');
const {
  presentVisit,
  relationshipGroupFields,
  relationshipJoinParams,
  relationshipJoins,
  relationshipSelectFields,
  relationshipWhere,
} = require('./visitPrivacy');

const router = express.Router();
const BUSY_WINDOW_DAYS = 14;
let optionalDbUnavailableUntil = 0;

function mapLocalPark(row) {
  const amenities = toOptionalJson(row.amenities, []);
  return {
    source: row.google_place_id ? 'google' : 'local',
    id: row.id,
    parkId: row.id,
    googlePlaceId: row.google_place_id || '',
    name: row.name || row.park_name,
    park_name: row.name || row.park_name,
    address: row.address || '',
    city: row.city || '',
    state: row.state || '',
    location: row.location || [row.city, row.state].filter(Boolean).join(', '),
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    size: row.size || '',
    is_public: row.is_public !== 0,
    amenities,
    notes: row.notes || row.description || '',
    image_URL: row.image_url || row.image_URL || '',
    community: {
      fenceStatus: row.fence_status || '',
      smallDogArea: Boolean(row.small_dog_area),
      largeDogArea: Boolean(row.large_dog_area),
      waterAvailable: Boolean(row.water_available),
      shadeAvailable: Boolean(row.shade_available),
      lightingAvailable: Boolean(row.lighting_available),
      surface: row.surface || '',
      accessibilityNotes: row.accessibility_notes || '',
      safetyNotes: row.safety_notes || '',
      rules: row.rules || '',
    },
  };
}

async function savePlaceReference(place) {
  if (!place.googlePlaceId) return;
  try {
    await db.query(
      `INSERT INTO park_place_refs (id, google_place_id, first_seen_at, last_seen_at)
       VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE last_seen_at = CURRENT_TIMESTAMP`,
      [crypto.randomUUID(), place.googlePlaceId],
    );
  } catch {
    // The Google result is still valid even if the local reference table has not been migrated yet.
  }
}

async function searchLocalParks(query) {
  const searchTerm = `%${query.query || query.location || ''}%`;
  const [parks] = await db.query(
    `SELECT * FROM parks
     WHERE (? = '%%'
       OR name LIKE ?
       OR park_name LIKE ?
       OR address LIKE ?
       OR city LIKE ?
       OR state LIKE ?
       OR location LIKE ?)
     ORDER BY COALESCE(name, park_name)
     LIMIT ?`,
    [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, Number(query.limit || 24)],
  );
  return parks.map(mapLocalPark);
}

async function optionalQuery(sql, params = [], timeoutMs = config.nodeEnv === 'production' ? 1500 : 350) {
  if (config.nodeEnv !== 'production' && Date.now() < optionalDbUnavailableUntil) {
    return [[]];
  }
  try {
    return await Promise.race([
      db.query(sql, params),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Optional database query timed out')), timeoutMs)),
    ]);
  } catch {
    if (config.nodeEnv !== 'production') {
      optionalDbUnavailableUntil = Date.now() + 10000;
    }
    return [[]];
  }
}

function visitSelectFields(includeInterested = false, includeViewer = false) {
  return `SELECT v.id, v.user_id AS owner_user_id, v.starts_at, v.duration_minutes, v.status, v.notes, v.social_intent,
              u.username, u.full_name,
              d.id AS dog_id,
              CASE WHEN d.is_public = 1 THEN d.name ELSE NULL END AS dog_name,
              CASE WHEN d.is_public = 1 THEN d.size ELSE NULL END AS dog_size,
              CASE WHEN d.is_public = 1 THEN d.breed ELSE NULL END AS dog_breed,
              CASE WHEN d.is_public = 1 THEN d.breed_key ELSE NULL END AS dog_breed_key,
              CASE WHEN d.is_public = 1 THEN d.avatar_url ELSE NULL END AS dog_avatar_url,
              COUNT(DISTINCT vi.user_id) AS interest_count,
              ${includeInterested ? 'my_vi.user_id IS NOT NULL' : 'FALSE'} AS is_interested,
              ${relationshipSelectFields(includeViewer)}`;
}

function visitJoins(includeInterested = false, includeViewer = false) {
  return `FROM visits v
       JOIN users u ON u.id = v.user_id
       LEFT JOIN dogs d ON d.id = v.dog_id AND d.deleted_at IS NULL
       LEFT JOIN visit_interests vi ON vi.visit_id = v.id
       ${includeInterested ? 'LEFT JOIN visit_interests my_vi ON my_vi.visit_id = v.id AND my_vi.user_id = ?' : ''}
       ${relationshipJoins('v.user_id', includeViewer)}`;
}

function visitGroupFields(includeInterested = false, includeViewer = false) {
  return `GROUP BY v.id, v.user_id, v.starts_at, v.duration_minutes, v.status, v.notes, v.social_intent,
              u.username, u.full_name, d.id, d.is_public, d.name, d.size, d.breed, d.breed_key, d.avatar_url${
                includeInterested ? ', my_vi.user_id' : ''
              }${relationshipGroupFields(includeViewer)}`;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hourLabel(hour) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour} ${suffix}`;
}

function busyLabel(dogCount, peakDogCount) {
  if (!dogCount) return 'No posted plans';
  if (peakDogCount <= 1 || dogCount / peakDogCount < 0.45) return 'Light';
  if (dogCount / peakDogCount < 0.75) return 'Steady';
  return 'Busiest posted window';
}

function buildBusyTimes(visits) {
  const now = Date.now();
  const windowEnd = now + BUSY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const dayBuckets = new Map();

  visits.forEach((visit) => {
    const startsAt = new Date(visit.starts_at);
    const timestamp = startsAt.getTime();
    if (Number.isNaN(timestamp) || timestamp < now || timestamp > windowEnd || visit.status === 'cancelled') return;
    const date = localDateKey(startsAt);
    const hour = startsAt.getHours();
    const day = dayBuckets.get(date) || {
      date,
      weekday: startsAt.toLocaleDateString('en-US', { weekday: 'short' }),
      slots: new Map(),
    };
    const slot = day.slots.get(hour) || {
      hour,
      hourLabel: hourLabel(hour),
      dogCount: 0,
      ownerIds: new Set(),
    };
    slot.dogCount += 1;
    slot.ownerIds.add(String(visit.owner_user_id || visit.user_id || visit.username || visit.id));
    day.slots.set(hour, slot);
    dayBuckets.set(date, day);
  });

  const peakDogCount = Math.max(
    0,
    ...[...dayBuckets.values()].flatMap((day) => [...day.slots.values()].map((slot) => slot.dogCount)),
  );
  const days = [...dayBuckets.values()]
    .sort((first, second) => first.date.localeCompare(second.date))
    .map((day) => {
      const slots = [...day.slots.values()]
        .sort((first, second) => first.hour - second.hour)
        .map((slot) => ({
          hour: slot.hour,
          hourLabel: slot.hourLabel,
          dogCount: slot.dogCount,
          ownerCount: slot.ownerIds.size,
          intensity: peakDogCount ? Math.max(12, Math.round((slot.dogCount / peakDogCount) * 100)) : 0,
          label: busyLabel(slot.dogCount, peakDogCount),
        }));
      const peak = slots.reduce((best, slot) => (slot.dogCount > best.dogCount ? slot : best), slots[0]);
      return {
        date: day.date,
        weekday: day.weekday,
        totalDogs: slots.reduce((sum, slot) => sum + slot.dogCount, 0),
        peakHour: peak?.hourLabel || '',
        peakDogCount: peak?.dogCount || 0,
        slots,
      };
    });

  const peak = days
    .flatMap((day) => day.slots.map((slot) => ({ ...slot, date: day.date, weekday: day.weekday })))
    .sort((first, second) => second.dogCount - first.dogCount)[0] || null;

  const totalDogs = days.reduce((sum, day) => sum + day.totalDogs, 0);
  if (totalDogs < 3) return null;

  return {
    source: 'first_party_scheduled_visits',
    windowDays: BUSY_WINDOW_DAYS,
    generatedAt: new Date().toISOString(),
    totalDogs,
    peak,
    days,
  };
}

router.get('/search', optionalAuth, async (req, res) => {
  try {
    const data = await searchDogParks(req.query);
    Promise.allSettled(data.results.map(savePlaceReference)).catch(() => {});
    res.json({
      ...data,
      googleAttributionRequired: true,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error.statusCode === 503) {
      const results = await searchLocalParks(req.query);
      return res.json({
        results,
        nextPageToken: null,
        googleAttributionRequired: false,
        warning: 'Google Places is not configured; returned local database results.',
      });
    }
    handleRouteError(res, error);
  }
});

router.get('/photos', async (req, res) => {
  try {
    requireFields(req.query, ['name']);
    const photo = await fetchPhoto(req.query.name, req.query.maxWidth);
    res.setHeader('Content-Type', photo.contentType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(photo.buffer);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get('/', async (req, res) => {
  try {
    const results = await searchLocalParks(req.query);
    res.json(results);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get('/:parkId', optionalAuth, async (req, res) => {
  try {
    const parkId = req.params.parkId;
    let park;

    if (parkId.startsWith('places/') || parkId.startsWith('ChI') || req.query.source === 'google') {
      park = await getPlaceDetails(parkId.replace(/^places\//, ''), {
        preferCache: true,
        timeoutMs: 2500,
        allowMinimalFallback: true,
      });
      savePlaceReference(park).catch(() => {});
    } else {
      const [parks] = await db.query('SELECT * FROM parks WHERE id = ? OR google_place_id = ?', [parkId, parkId]);
      if (!parks[0]) return res.status(404).json({ error: 'Park not found' });
      park = mapLocalPark(parks[0]);
    }

    const lookupId = park.googlePlaceId || park.id || parkId;
    const signedInUserId = req.user?.id || '';
    const isDevUser = signedInUserId && isDevAuthUserId(signedInUserId);
    const includeViewer = Boolean(signedInUserId && !isDevUser);
    const [reviews] = await optionalQuery(
      `SELECT r.id, r.rating, r.title, r.body, r.helpful_count, r.created_at,
              u.id AS user_id, u.username, u.full_name
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       ${
         includeViewer
           ? `LEFT JOIN user_blocks blocked_by_author ON blocked_by_author.blocker_user_id = r.user_id AND blocked_by_author.blocked_user_id = ?
              LEFT JOIN user_blocks blocked_author ON blocked_author.blocker_user_id = ? AND blocked_author.blocked_user_id = r.user_id`
           : ''
       }
       WHERE r.park_ref = ? AND r.status = 'published'
       ${includeViewer ? 'AND blocked_by_author.blocker_user_id IS NULL AND blocked_author.blocker_user_id IS NULL' : ''}
       ORDER BY r.created_at DESC
       LIMIT 20`,
      includeViewer ? [signedInUserId, signedInUserId, lookupId] : [lookupId],
    );
    const [databaseVisits] = await optionalQuery(
      `${visitSelectFields(includeViewer, includeViewer)}
       ${visitJoins(includeViewer, includeViewer)}
       WHERE v.park_ref = ? AND v.starts_at >= CURRENT_TIMESTAMP
       ${relationshipWhere(includeViewer)}
       ${visitGroupFields(includeViewer, includeViewer)}
       ORDER BY v.starts_at ASC
      LIMIT 20`,
      includeViewer ? [signedInUserId, ...relationshipJoinParams(signedInUserId), lookupId] : [lookupId],
    );
    const devVisits =
      isDevUser
        ? listDevVisits({ ownerId: signedInUserId, parkId: lookupId })
        : [];
    const visits = [...databaseVisits.map((visit) => presentVisit(visit, signedInUserId)), ...devVisits]
      .sort((first, second) => String(first.starts_at).localeCompare(String(second.starts_at)))
      .slice(0, 20);
    const [databaseTodayVisits] = await optionalQuery(
      `${visitSelectFields(includeViewer, includeViewer)}
       ${visitJoins(includeViewer, includeViewer)}
       WHERE v.park_ref = ?
         AND v.status != 'cancelled'
         AND v.starts_at >= CURDATE()
         AND v.starts_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
       ${relationshipWhere(includeViewer)}
       ${visitGroupFields(includeViewer, includeViewer)}
       ORDER BY v.starts_at ASC
       LIMIT 50`,
      includeViewer ? [signedInUserId, ...relationshipJoinParams(signedInUserId), lookupId] : [lookupId],
    );
    const devTodayVisits =
      isDevUser
        ? listDevVisits({ ownerId: signedInUserId, parkId: lookupId, todayOnly: true })
        : [];
    const todayVisits = [...databaseTodayVisits.map((visit) => presentVisit(visit, signedInUserId)), ...devTodayVisits]
      .sort((first, second) => String(first.starts_at).localeCompare(String(second.starts_at)))
      .slice(0, 50);
    const [databaseBusyVisits] = signedInUserId
      ? await optionalQuery(
          `SELECT v.id, v.user_id AS owner_user_id, v.starts_at, v.duration_minutes, v.status
           FROM visits v
           WHERE v.park_ref = ?
             AND v.status != 'cancelled'
             AND v.starts_at >= CURRENT_TIMESTAMP
             AND v.starts_at < DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ${BUSY_WINDOW_DAYS} DAY)
           ORDER BY v.starts_at ASC
           LIMIT 300`,
          [lookupId],
        )
      : [[]];
    const devBusyVisits =
      isDevUser
        ? listDevVisits({ ownerId: signedInUserId, parkId: lookupId })
        : [];
    const busyTimes = signedInUserId ? buildBusyTimes([...databaseBusyVisits, ...devBusyVisits]) : null;

    res.json({
      ...park,
      reviews: reviews.map((review) => (signedInUserId ? review : { ...review, username: '', full_name: '' })),
      todayVisits,
      upcomingVisits: visits,
      busyTimes,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/:parkId/suggest-edit', requireAuth, async (req, res) => {
  try {
    requireFields(req.body, ['summary']);
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO park_suggestions
       (id, park_ref, user_id, summary, suggested_data, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      [id, req.params.parkId, req.user.id, req.body.summary, JSON.stringify(req.body.suggestedData || {})],
    );
    res.status(201).json({ id, status: 'open' });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    requireFields(req.body, ['name', 'address']);
    const id = crypto.randomUUID();
    const safeImageUrl = normalizeOptionalUrl(req.body.imageUrl, 'Park image URL');
    await db.query(
      `INSERT INTO parks
       (id, name, google_place_id, address, city, state, latitude, longitude, size, is_public, amenities, notes, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.body.name,
        req.body.googlePlaceId || null,
        req.body.address,
        req.body.city || null,
        req.body.state || null,
        req.body.latitude || null,
        req.body.longitude || null,
        req.body.size || null,
        req.body.isPublic === false ? 0 : 1,
        JSON.stringify(req.body.amenities || []),
        req.body.notes || null,
        safeImageUrl,
      ],
    );
    res.status(201).json({ id });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
