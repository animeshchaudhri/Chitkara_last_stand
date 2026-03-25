const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, user_id AS "userId", title, content, created_at AS "createdAt"
       FROM documents
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch documents', detail: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const id = uuidv4();
    const result = await query(
      `INSERT INTO documents (id, user_id, title, content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id AS "userId", title, content, created_at AS "createdAt"`,
      [id, req.user.userId, title, content || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create document', detail: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, user_id AS "userId", title, content, created_at AS "createdAt"
       FROM documents WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch document', detail: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, content } = req.body;
    const result = await query(
      `UPDATE documents
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING id, user_id AS "userId", title, content, created_at AS "createdAt"`,
      [title, content, req.params.id, req.user.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update document', detail: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document', detail: err.message });
  }
});

module.exports = router;
