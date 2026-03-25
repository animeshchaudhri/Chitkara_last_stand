const express = require('express');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const cors    = require('cors');
const { Pool } = require('pg');

const app        = express();
const PORT       = process.env.PORT || 3012;
const JWT_SECRET = process.env.JWT_SECRET || 'ms_secret_key_2024';

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'ms_db',
  max: 20,                      // raise from default 10 to prevent pool exhaustion under load
  idleTimeoutMillis: 30000,     // release idle connections after 30s
  connectionTimeoutMillis: 2000, // fail fast instead of hanging when pool is full
});

const query = (text, params) => pool.query(text, params);

async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

app.use(cors());
app.use(express.json());

// ── JWT Middleware ─────────────────────────────────────────────
const jwtMiddleware = (req, res, next) => {
  // Skip auth for health check
  if (req.path === '/health') return next();
  
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

app.use(jwtMiddleware);

app.get('/api/data', async (req, res) => {
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

app.post('/api/data', async (req, res) => {
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

app.get('/api/data/:id', async (req, res) => {
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

app.put('/api/data/:id', async (req, res) => {
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

app.delete('/api/data/:id', async (req, res) => {
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

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'data', architecture: 'microservices' }));

async function start() {
  try {
    await initDb();
    app.listen(PORT, () =>
      console.log(`[DATA-SERVICE] Running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('[DATA-SERVICE] Failed to initialize database:', err);
    process.exit(1);
  }
}

start();
