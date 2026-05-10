const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const { requireAuth } = require('./auth');
const { handleRouteError } = require('./validation');

const router = express.Router();
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function contentType(req) {
  return String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
}

function validateImageRequest(req) {
  const mimeType = contentType(req);
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    const error = new Error('Photo must be a JPEG, PNG, or WebP image');
    error.statusCode = 415;
    throw error;
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    const error = new Error('Photo upload is empty');
    error.statusCode = 400;
    throw error;
  }
  if (req.body.length > MAX_IMAGE_BYTES) {
    const error = new Error('Photo must be 3 MB or smaller');
    error.statusCode = 413;
    throw error;
  }
  return mimeType;
}

router.post('/', requireAuth, express.raw({ type: Array.from(ALLOWED_MIME_TYPES), limit: `${MAX_IMAGE_BYTES}b` }), async (req, res) => {
  try {
    const mimeType = validateImageRequest(req);
    const id = crypto.randomUUID();
    const purpose = String(req.query.purpose || 'profile_photo').slice(0, 60);

    await db.query(
      `INSERT INTO media_assets (id, owner_ref, purpose, mime_type, byte_size, data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, String(req.user.id), purpose, mimeType, req.body.length, req.body],
    );

    res.status(201).json({
      id,
      url: `/api/media/${id}`,
      mimeType,
      byteSize: req.body.length,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT mime_type, byte_size, data FROM media_assets WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Photo not found' });

    res.setHeader('Content-Type', rows[0].mime_type);
    res.setHeader('Content-Length', String(rows[0].byte_size));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(rows[0].data);
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
