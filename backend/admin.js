const express = require('express');
const db = require('./db');
const { requireAdmin } = require('./auth');
const { handleRouteError } = require('./validation');

const router = express.Router();

router.use(requireAdmin);

router.get('/reports', async (_req, res) => {
  try {
    const [reports] = await db.query(
      `SELECT r.*, u.username AS reporter_username
       FROM reports r
       JOIN users u ON u.id = r.reporter_user_id
       ORDER BY r.created_at DESC
       LIMIT 200`,
    );
    res.json(reports);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.patch('/reports/:id', async (req, res) => {
  try {
    await db.query(
      `UPDATE reports
       SET status = COALESCE(?, status),
           moderator_user_id = ?,
           moderator_notes = COALESCE(?, moderator_notes),
           resolved_at = CASE WHEN ? IN ('resolved', 'dismissed') THEN CURRENT_TIMESTAMP ELSE resolved_at END
       WHERE id = ?`,
      [req.body.status || null, req.user.id, req.body.moderatorNotes || null, req.body.status, req.params.id],
    );
    res.json({ id: req.params.id });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.patch('/reviews/:id', async (req, res) => {
  try {
    await db.query('UPDATE reviews SET status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      req.body.status || null,
      req.params.id,
    ]);
    res.json({ id: req.params.id });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.patch('/photos/:id', async (req, res) => {
  try {
    await db.query('UPDATE photos SET status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      req.body.status || null,
      req.params.id,
    ]);
    res.json({ id: req.params.id });
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get('/suggestions', async (_req, res) => {
  try {
    const [suggestions] = await db.query(
      `SELECT s.*, u.username
       FROM park_suggestions s
       JOIN users u ON u.id = s.user_id
       ORDER BY s.created_at DESC
       LIMIT 200`,
    );
    res.json(suggestions);
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.patch('/suggestions/:id', async (req, res) => {
  try {
    await db.query(
      `UPDATE park_suggestions
       SET status = COALESCE(?, status),
           moderator_user_id = ?,
           moderator_notes = COALESCE(?, moderator_notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.body.status || null, req.user.id, req.body.moderatorNotes || null, req.params.id],
    );
    res.json({ id: req.params.id });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
