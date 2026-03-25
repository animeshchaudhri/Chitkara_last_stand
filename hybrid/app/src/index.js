const express = require('express');
const cors    = require('cors');

const authRoutes   = require('./routes/auth');
const dataRoutes   = require('./routes/data');
const reportRoutes = require('./routes/report');
const { initDb }   = require('./db');

const app  = express();
const PORT = process.env.PORT || 3021;

app.use(cors());
app.use(express.json());

// ── Trust x-user-id / x-username forwarded by the gateway ───
// The gateway already validated the JWT; this app trusts those headers.
const gatewayUserMiddleware = (req, res, next) => {
  const open = ['/api/auth/register', '/api/auth/login', '/health'];
  if (open.some(p => req.path.startsWith(p))) return next();

  const userId   = req.headers['x-user-id'];
  const username = req.headers['x-username'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized — missing gateway headers' });

  req.user = { userId, username };
  next();
};

app.use(gatewayUserMiddleware);

app.use('/api/auth',   authRoutes);
app.use('/api/data',   dataRoutes);
app.use('/api/report', reportRoutes);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', architecture: 'hybrid', role: 'app' }));

async function start() {
  try {
    await initDb();
    app.listen(PORT, () =>
      console.log(`[HYBRID-APP] Running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('[HYBRID-APP] Failed to initialize database:', err);
    process.exit(1);
  }
}

start();
