const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const cors    = require('cors');
const { Pool } = require('pg');

const app        = express();
const PORT       = process.env.PORT || 3011;
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
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

app.use(cors());
app.use(express.json());

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'username and password required' });

    const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rowCount > 0)
      return res.status(409).json({ error: 'Username already taken' });

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await query(
      'INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)',
      [id, username, passwordHash]
    );

    const token = jwt.sign({ userId: id, username }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ token, userId: id, username });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register user', detail: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
    if (result.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, userId: user.id, username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Failed to login', detail: err.message });
  }
});

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'auth', architecture: 'microservices' }));

async function start() {
  try {
    await initDb();
    app.listen(PORT, () =>
      console.log(`[AUTH-SERVICE] Running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('[AUTH-SERVICE] Failed to initialize database:', err);
    process.exit(1);
  }
}

start();
