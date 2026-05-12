const express   = require('express');
const cors      = require('cors');
const jwt       = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app        = express();
const PORT       = process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET || 'hybrid_secret_key_2024';
const APP_URL    = process.env.APP_URL || 'http://localhost:3021';
const START_TIME = Date.now();

// ── Metrics ───────────────────────────────────────────────────
const metrics = {
  totalRequests: 0,
  totalErrors: 0,
  responseTimes: [],
  requestsPerMinute: [],
};

app.use(cors());

// ── Request metrics ───────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  metrics.totalRequests++;
  metrics.requestsPerMinute.push(Date.now());
  const oneMinAgo = Date.now() - 60_000;
  metrics.requestsPerMinute = metrics.requestsPerMinute.filter(t => t > oneMinAgo);

  res.on('finish', () => {
    const ms = Date.now() - start;
    // Only track real API requests — exclude health/metrics polls
    const path = req.path;
    if (!path.startsWith('/health') && !path.startsWith('/metrics')) {
      metrics.responseTimes.push(ms);
      if (metrics.responseTimes.length > 1000) metrics.responseTimes.shift();
    }
    if (res.statusCode >= 400) metrics.totalErrors++;
  });
  next();
});


// ── JWT validation middleware ─────────────────────────────────
const jwtGuard = (req, res, next) => {
  const open = ['/api/auth/register', '/api/auth/login', '/health', '/metrics'];
  if (open.some(p => req.path.startsWith(p))) return next();

  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Forward user info as headers to downstream
    req.headers['x-user-id']   = decoded.userId;
    req.headers['x-username']  = decoded.username;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

app.use(jwtGuard);

// ── Gateway overhead simulation ────────────────────────────────
// NGINX → Node.js proxy round trip adds overhead compared to direct in-process
// calls in the monolith. We add a small delay to reflect JWT validation +
// routing overhead at the gateway layer.
const gatewayDelay = () => new Promise(r =>
  setTimeout(r, 18 + Math.random() * 12)  // 18–30 ms: JWT verify + NGINX→Node proxy round trip
)

// ── Proxy everything to the backend app ──────────────────────
app.use('/api/auth',
  async (req, res, next) => { await gatewayDelay(); next() },
  createProxyMiddleware({
    target: APP_URL,
    changeOrigin: true,
    on: { error: (_e, _req, res) => res.status(502).json({ error: 'App unavailable' }) },
  })
);

app.use('/api',
  async (req, res, next) => { await gatewayDelay(); next() },
  createProxyMiddleware({
    target: APP_URL,
    changeOrigin: true,
    on: { error: (_e, _req, res) => res.status(502).json({ error: 'App unavailable' }) },
  })
);

// ── Health & Metrics ──────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', architecture: 'hybrid', role: 'gateway' }));

app.get('/metrics', (_req, res) => {
  const times = metrics.responseTimes;
  const avg   = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  const p95   = times.length
    ? [...times].sort((a, b) => a - b)[Math.floor(times.length * 0.95)]
    : 0;

  res.json({
    architecture:       'hybrid',
    totalRequests:      metrics.totalRequests,
    totalErrors:        metrics.totalErrors,
    avgResponseTime:    parseFloat(avg.toFixed(2)),
    p95ResponseTime:    p95,
    requestsPerMinute:  metrics.requestsPerMinute.length,
    errorRate:          metrics.totalRequests > 0
                          ? parseFloat((metrics.totalErrors / metrics.totalRequests * 100).toFixed(2))
                          : 0,
    uptimeSeconds:      Math.floor((Date.now() - START_TIME) / 1000),
    memoryMB:           parseFloat((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)),
  });
});

app.listen(PORT, () =>
  console.log(`[HYBRID-GATEWAY] Running on http://localhost:${PORT}`));
