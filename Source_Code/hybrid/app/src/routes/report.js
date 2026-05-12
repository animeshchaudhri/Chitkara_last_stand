const router = require('express').Router();
const { query } = require('../db');

router.get('/summary', async (req, res) => {
  try {
    const [countDocs, countUsers, oldestDoc, latestDoc] = await Promise.all([
      query('SELECT COUNT(*)::int AS count FROM documents WHERE user_id = $1', [req.user.userId]),
      query('SELECT COUNT(*)::int AS count FROM users'),
      query(
        `SELECT id, user_id AS "userId", title, content, created_at AS "createdAt"
         FROM documents WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
        [req.user.userId]
      ),
      query(
        `SELECT id, user_id AS "userId", title, content, created_at AS "createdAt"
         FROM documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [req.user.userId]
      ),
    ]);

    res.json({
      totalDocuments: countDocs.rows[0].count,
      totalUsers: countUsers.rows[0].count,
      oldestDoc: oldestDoc.rowCount ? oldestDoc.rows[0] : null,
      latestDoc: latestDoc.rowCount ? latestDoc.rows[0] : null,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build summary report', detail: err.message });
  }
});

router.get('/activity', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, user_id AS "userId", title, content, created_at AS "createdAt"
       FROM documents
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [req.user.userId]
    );
    res.json({ recentActivity: result.rows, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity report', detail: err.message });
  }
});

module.exports = router;
