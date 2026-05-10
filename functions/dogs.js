const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const { requireAuth } = require('./auth');
const { createDevDog, deleteDevDog, isDevAuthUserId, listDevDogs, updateDevDog } = require('./devAuthFallback');
const { canonicalBreedKey } = require('./breedCatalog');
const { handleRouteError, normalizeBoolean, normalizeOptionalUrl, requireFields } = require('./validation');

const router = express.Router();

function mapDog(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    dog_name: row.name,
    name: row.name,
    size: row.size,
    breed: row.breed || '',
    breedKey: row.breed_key || canonicalBreedKey(row.breed),
    avatarUrl: row.avatar_url || '',
    isFriendly: Boolean(row.is_friendly),
    isPuppy: Boolean(row.is_puppy),
    isPublic: Boolean(row.is_public),
    notes: row.notes || '',
    createdAt: row.created_at,
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) {
      return res.json(listDevDogs(req.user.id));
    }

    const [dogs] = await db.query(
      `SELECT id, owner_id, name, size, breed, breed_key, avatar_url, is_friendly, is_puppy, is_public, notes, created_at
       FROM dogs
       WHERE owner_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [req.user.id],
    );
    res.json(dogs.map(mapDog));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get('/owner/:ownerId', async (req, res) => {
  try {
    if (isDevAuthUserId(req.params.ownerId)) {
      return res.json(listDevDogs(req.params.ownerId, true));
    }

    const [dogs] = await db.query(
      `SELECT id, owner_id, name, size, breed, breed_key, avatar_url, is_friendly, is_puppy, is_public, notes, created_at
       FROM dogs
       WHERE owner_id = ? AND is_public = 1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [req.params.ownerId],
    );
    res.json(dogs.map(mapDog));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const dogName = req.body.name || req.body.dog_name;
    requireFields({ ...req.body, name: dogName }, ['name', 'size']);
    const safeAvatarUrl = req.body.avatarUrl === '' ? '' : normalizeOptionalUrl(req.body.avatarUrl, 'Dog photo URL');
    const safeBreed = req.body.breed || null;
    const safeBreedKey = req.body.breedKey || req.body.breed_key || canonicalBreedKey(safeBreed);

    if (isDevAuthUserId(req.user.id)) {
      return res.status(201).json(createDevDog(req.user.id, { ...req.body, name: dogName, breed: safeBreed || '', breedKey: safeBreedKey, avatarUrl: safeAvatarUrl }));
    }

    const id = crypto.randomUUID();

    await db.query(
      `INSERT INTO dogs
       (id, owner_id, name, size, breed, breed_key, avatar_url, is_friendly, is_puppy, is_public, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.user.id,
        dogName,
        req.body.size,
        safeBreed,
        safeBreedKey || null,
        safeAvatarUrl,
        normalizeBoolean(req.body.isFriendly ?? req.body.is_friendly ?? true),
        normalizeBoolean(req.body.isPuppy ?? req.body.is_puppy ?? false),
        normalizeBoolean(req.body.isPublic ?? true),
        req.body.notes || null,
      ],
    );

    const [dogs] = await db.query('SELECT * FROM dogs WHERE id = ?', [id]);
    res.status(201).json(mapDog(dogs[0]));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const safeAvatarUrl = req.body.avatarUrl === '' ? '' : normalizeOptionalUrl(req.body.avatarUrl, 'Dog photo URL');
    const safeBreed = req.body.breed || null;
    const safeBreedKey = req.body.breedKey || req.body.breed_key || (safeBreed ? canonicalBreedKey(safeBreed) : null);

    if (isDevAuthUserId(req.user.id)) {
      const dog = updateDevDog(req.user.id, req.params.id, { ...req.body, breedKey: safeBreedKey, avatarUrl: safeAvatarUrl });
      if (!dog) return res.status(404).json({ error: 'Dog not found' });
      return res.json(dog);
    }

    await db.query(
      `UPDATE dogs
       SET name = COALESCE(?, name),
           size = COALESCE(?, size),
           breed = COALESCE(?, breed),
           breed_key = COALESCE(?, breed_key),
           avatar_url = COALESCE(?, avatar_url),
           is_friendly = COALESCE(?, is_friendly),
           is_puppy = COALESCE(?, is_puppy),
           is_public = COALESCE(?, is_public),
           notes = COALESCE(?, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND owner_id = ? AND deleted_at IS NULL`,
      [
        req.body.name || req.body.dog_name || null,
        req.body.size || null,
        safeBreed,
        safeBreedKey,
        safeAvatarUrl,
        req.body.isFriendly === undefined ? null : normalizeBoolean(req.body.isFriendly),
        req.body.isPuppy === undefined ? null : normalizeBoolean(req.body.isPuppy),
        req.body.isPublic === undefined ? null : normalizeBoolean(req.body.isPublic),
        req.body.notes ?? null,
        req.params.id,
        req.user.id,
      ],
    );

    const [dogs] = await db.query('SELECT * FROM dogs WHERE id = ? AND owner_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!dogs[0]) return res.status(404).json({ error: 'Dog not found' });
    res.json(mapDog(dogs[0]));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (isDevAuthUserId(req.user.id)) {
      if (!deleteDevDog(req.user.id, req.params.id)) return res.status(404).json({ error: 'Dog not found' });
      return res.status(204).end();
    }

    const [result] = await db.query(
      'UPDATE dogs SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ? AND deleted_at IS NULL',
      [req.params.id, req.user.id],
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Dog not found' });
    res.status(204).end();
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
