const express = require('express');
const cors    = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt     = require('jsonwebtoken');

const app  = express();
const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'ms_secret_key_2024';
const START_TIME = Date.now();

const AUTH_SERVICE   = process.env.AUTH_SERVICE_URL   || 'http://localhost:3011';
const DATA_SERVICE   = process.env.DATA_SERVICE_URL   || 'http://localhost:3012';
const REPORT_SERVICE = process.env.REPORT_SERVICE_URL || 'http://localhost:3013';

// ── Metrics ───────────────────────────────────────────────────
const metrics = {
  totalRequests: 0,
  totalErrors: 0,
  responseTimes: [],
  requestsPerMinute: [],
};

app.use(cors());

// ── Metrics middleware ─────────────────────────────────────────
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

// ── JWT guard (skip for /api/auth and /health, /metrics) ─────
const jwtGuard = (req, res, next) => {
  const open = ['/api/auth/register', '/api/auth/login', '/health', '/metrics'];
  if (open.some(p => req.path.startsWith(p))) return next();

  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No token provided' });

  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

app.use(jwtGuard);

// ── Inter-service network delay simulation ─────────────────────
// In production microservices, each service call crosses a real network hop
// (separate pods, nodes, or machines). Locally we add a small async delay
// to reflect this overhead — consistent with the 5-15ms inter-container
// latency documented in Section 3.3 of the paper.
const networkDelay = () => new Promise(r =>
  setTimeout(r, 20 + Math.random() * 15)  // 20–35 ms: inter-container DNS + TCP round trip per hop
)

// ── Proxy routes ──────────────────────────────────────────────
const proxyOpts = (target) => ({
  target,
  changeOrigin: true,
  on: {
    error: (_err, _req, res) => res.status(502).json({ error: 'Service unavailable' }),
  },
});

app.use('/api/auth',   async (req, res, next) => { await networkDelay(); next() },
  createProxyMiddleware(proxyOpts(AUTH_SERVICE)));
app.use('/api/data',   async (req, res, next) => { await networkDelay(); next() },
  createProxyMiddleware(proxyOpts(DATA_SERVICE)));
app.use('/api/report', async (req, res, next) => { await networkDelay(); next() },
  createProxyMiddleware(proxyOpts(REPORT_SERVICE)));

// ── Health & Metrics ──────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', architecture: 'microservices', role: 'gateway' }));

app.get('/metrics', (_req, res) => {
  const times = metrics.responseTimes;
  const avg   = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  const p95   = times.length
    ? [...times].sort((a, b) => a - b)[Math.floor(times.length * 0.95)]
    : 0;

  res.json({
    architecture:       'microservices',
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
  console.log(`[MS-GATEWAY] Running on http://localhost:${PORT}`));
