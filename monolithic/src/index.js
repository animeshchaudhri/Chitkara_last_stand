const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const reportRoutes = require('./routes/report');
const { authMiddleware } = require('./middleware/auth');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const START_TIME = Date.now();

// ──────────────────────────────────────────────────────────────
// In-memory metrics (simulates Prometheus counters)
// ──────────────────────────────────────────────────────────────
const metrics = {
  totalRequests: 0,
  totalErrors: 0,
  responseTimes: [],        // rolling window (last 1000 values)
  requestsPerMinute: [],    // timestamps for RPS calculation
};

app.use(cors());
app.use(express.json());

// ──────────────────────────────────────────────────────────────
// Metrics middleware — wraps every response
// ──────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  metrics.totalRequests++;
  metrics.requestsPerMinute.push(Date.now());

  // keep only last 60 s of timestamps
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

// ──────────────────────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/data', authMiddleware, dataRoutes);
app.use('/api/report', authMiddleware, reportRoutes);

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', architecture: 'monolithic' }));

// ── Metrics endpoint (consumed by the dashboard) ─────────────
app.get('/metrics', (_req, res) => {
  const times = metrics.responseTimes;
  const avg   = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  const p95   = times.length
    ? [...times].sort((a, b) => a - b)[Math.floor(times.length * 0.95)]
    : 0;

  res.json({
    architecture:       'monolithic',
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

async function start() {
  try {
    await initDb();
    app.listen(PORT, () =>
      console.log(`[MONOLITHIC] Running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('[MONOLITHIC] Failed to initialize database:', err);
    process.exit(1);
  }
}

start();
