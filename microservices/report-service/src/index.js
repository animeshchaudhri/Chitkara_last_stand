const express = require('express');
const axios   = require('axios');
const jwt     = require('jsonwebtoken');
const cors    = require('cors');

const app        = express();
const PORT       = process.env.PORT || 3013;
const JWT_SECRET = process.env.JWT_SECRET || 'ms_secret_key_2024';
const DATA_SVC   = process.env.DATA_SERVICE_URL || 'http://localhost:3012';

app.use(cors());
app.use(express.json());

// ── JWT Middleware ─────────────────────────────────────────────
const jwtMiddleware = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    req.token = token;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

app.use(jwtMiddleware);

// GET /api/report/summary — calls data-service internally
app.get('/api/report/summary', async (req, res) => {
  try {
    const { data: docs } = await axios.get(`${DATA_SVC}/api/data`, {
      headers: { authorization: `Bearer ${req.token}` },
    });

    res.json({
      totalDocuments: docs.length,
      oldestDoc: docs.length ? [...docs].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0] : null,
      latestDoc: docs.length ? [...docs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] : null,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({ error: 'Could not reach data-service', detail: err.message });
  }
});

// GET /api/report/activity
app.get('/api/report/activity', async (req, res) => {
  try {
    const { data: docs } = await axios.get(`${DATA_SVC}/api/data`, {
      headers: { authorization: `Bearer ${req.token}` },
    });
    const sorted = [...docs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
    res.json({ recentActivity: sorted, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ error: 'Could not reach data-service', detail: err.message });
  }
});

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'report', architecture: 'microservices' }));

app.listen(PORT, () =>
  console.log(`[REPORT-SERVICE] Running on http://localhost:${PORT}`));
