# ArchBench — Backend Architecture Comparative Study

**A Practical Comparative Study of Scalable and Secure Backend Architectures for Resource-Constrained Web Applications**

This repository contains the complete experimental infrastructure for an empirical comparison of three backend architectural patterns — monolithic, microservices, and hybrid — evaluated against standardized load profiles on commodity hardware. It includes production-equivalent Node.js implementations of each architecture, automated k6 load testing at three concurrency levels, and a live React dashboard that renders both real-time metrics and paper-derived benchmark results.

---

## Key Findings

| Architecture | Avg RT @ 50 VU | Avg RT @ 500 VU | Error Rate @ 500 VU | Memory (RSS) |
|---|---|---|---|---|
| Monolithic | 42 ms | 1347 ms | 4.71% | ~410 MB |
| Microservices | 63 ms | 188 ms | 0.19% | ~855 MB |
| Hybrid | 55 ms | 258 ms | 0.51% | ~590 MB |

The monolithic architecture achieved lowest latency under low load but degraded sharply above 200 concurrent users due to PostgreSQL connection pool exhaustion and single-threaded event loop saturation. The microservices architecture sustained the highest throughput (265 RPS at 500 VU) at the cost of approximately double the memory footprint. The hybrid architecture offered the most consistent security posture through centralized JWT validation and rate limiting at the gateway layer.

Full results and analysis: see [FINAL RESEARCH PAPER.pdf](./FINAL%20RESEARCH%20PAPER.pdf).

---

## Research Design

### Workload Model

Each k6 virtual user executes a realistic mixed-workload iteration:

1. `POST /api/auth/register` — creates a unique user account
2. `POST /api/auth/login` — exchanges credentials for a JWT
3. `POST /api/data` x5 — sequential write operations (document creation)
4. `GET /api/report/summary` x2 — read-heavy aggregation queries

This yields 8 HTTP calls per iteration, designed to stress both the authentication path and the read/write paths simultaneously.

### Load Levels

| Level | Virtual Users | Ramp-up | Hold | Ramp-down |
|---|---|---|---|---|
| Low | 50 | 30 s | 3 min | 30 s |
| Medium | 200 | 30 s | 3 min | 30 s |
| High | 500 | 30 s | 3 min | 30 s |

Each level was tested three times; reported values are averages over runs.

### Hardware

Two Dell OptiPlex 7080 machines (Intel Core i5-10400, 8 GB DDR4, 256 GB SSD, Ubuntu 22.04 LTS). One machine hosted the application and databases; the second was dedicated to k6 load generation. Tests were conducted over a wired LAN during off-peak hours.

### Software Stack

Node.js 18.17.1, Express 4.18.2, PostgreSQL 15.3, Docker 24.0.5, k6 v0.45.0, PM2 5.3.0.

---

## Architecture Implementations

### Monolithic

A single Node.js process where all three functional modules — authentication, data processing, and reporting — operate as Express routers within the same application. PostgreSQL handles persistent storage. A single connection pool is shared across all routes, which becomes the primary bottleneck under high concurrency.

```
Client
  └── Express App :3001
        ├── JWT Middleware
        ├── POST /api/auth/register|login  (bcrypt, JWT issuance)
        ├── GET|POST|PUT|DELETE /api/data  (document CRUD)
        └── GET /api/report/summary|activity
              └── PostgreSQL (mono_db)
```

### Microservices

Three independently deployed Node.js services communicating over a Docker user-defined bridge network. An API gateway performs JWT validation and proxies requests, adding a simulated 20–35 ms inter-service network hop consistent with measured inter-container latency.

```
Client
  └── API Gateway :3002  (JWT guard + proxy)
        ├── /api/auth   --> Auth Service :3011 --> PostgreSQL (users)
        ├── /api/data   --> Data Service :3012 --> PostgreSQL (documents)
        └── /api/report --> Report Service :3013
                              └── (calls Data Service internally)
```

**Security note:** During testing, a defect was identified in the data service's JWT middleware — it validated the token signature but did not check the `exp` claim, permitting expired tokens. This illustrates the systemic risk of independently implemented security logic across services.

### Hybrid

The same monolithic Node.js application deployed behind a Node.js API gateway. The gateway handles JWT validation, rate limiting (100 req/s/IP returning HTTP 429 on excess), and request routing. The application layer performs no authentication itself.

```
Client
  └── Gateway :3003
        ├── Rate Limiter (100 req/s/IP)
        ├── JWT Validation (centralised)
        └── Reverse Proxy (+18-30 ms overhead)
              └── Monolithic App :3021
                    └── PostgreSQL (hybrid_db)
```

---

## Repository Structure

```
.
├── monolithic/                  Single-process Node.js backend
│   └── src/
│       ├── index.js             Express app, metrics middleware
│       ├── db.js                PostgreSQL pool + schema init
│       ├── middleware/auth.js
│       └── routes/              auth.js  data.js  report.js
│
├── microservices/
│   ├── gateway/src/index.js     JWT guard, proxy, metrics
│   ├── auth-service/src/        User registration and login
│   ├── data-service/src/        Document CRUD
│   ├── report-service/src/      Aggregation (calls data-service)
│   └── docker-compose.yml
│
├── hybrid/
│   ├── gateway/src/index.js     Rate limiter, JWT, reverse proxy
│   ├── app/src/                 Monolithic app (no auth logic)
│   └── docker-compose.yml
│
├── dashboard/                   React + Recharts live dashboard
│   └── src/components/
│       ├── MetricsOverview.jsx  Live stat cards per architecture
│       ├── ResponseTimeChart.jsx  Rolling latency line chart
│       ├── ErrorRateChart.jsx   Error rate area chart
│       ├── ThroughputGauge.jsx  Requests/min bar chart
│       ├── ComparisonTable.jsx  Side-by-side best/worst table
│       └── BenchmarkResults.jsx  k6 benchmark results + scoring
│
├── load-tests/
│   ├── monolithic-test.js       k6 script for monolithic
│   ├── microservices-test.js    k6 script for microservices
│   ├── hybrid-test.js           k6 script for hybrid
│   ├── live-load.js             Continuous background load (dashboard)
│   ├── summarize-results.js     Aggregates run JSONs → benchmark_summary.json
│   └── run-all-tests.sh         Runs all 9 test combinations (3 arch x 3 levels)
│
├── docker-compose.yml           Master orchestration — starts everything
└── FINAL RESEARCH PAPER.pdf
```

---

## Quickstart

### Docker (recommended)

```bash
docker compose up --build
```

All services start in dependency order. The dashboard becomes available once all three backends pass their health checks.

| Service | URL |
|---|---|
| Dashboard | http://localhost:5173 |
| Monolithic API | http://localhost:3001 |
| Microservices Gateway | http://localhost:3002 |
| Hybrid Gateway | http://localhost:3003 |

### Without Docker

```bash
# Monolithic
cd monolithic && npm install && npm start

# Microservices (four processes)
cd microservices/auth-service   && npm install && npm start &
cd microservices/data-service   && npm install && npm start &
cd microservices/report-service && npm install && npm start &
cd microservices/gateway        && npm install && npm start

# Hybrid
cd hybrid/app     && npm install && npm start &
cd hybrid/gateway && npm install && npm start

# Dashboard
cd dashboard && npm install && npm run dev
```

---

## Running Load Tests

Install k6:

```bash
# Ubuntu / Debian
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
     --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
     | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# macOS
brew install k6
```

Run the full test suite (all 3 architectures x 3 VU levels x 3 runs = 27 test runs):

```bash
bash load-tests/run-all-tests.sh
```

Results are written to `load-tests/results/` as individual `_summary.json` files. After the suite completes, aggregate them and push to the dashboard:

```bash
node load-tests/summarize-results.js
```

This regenerates `dashboard/public/benchmark_summary.json`, which the dashboard fetches to populate the benchmark results section.

---

## Dashboard

The dashboard auto-polls all three `/metrics` endpoints every 3 seconds and renders:

- **Live Architecture Metrics** — per-backend stat cards (response time, RPM, error rate, memory, uptime)
- **Response Time Over Time** — rolling 3-minute line chart
- **Requests / Minute** — bar chart
- **Memory Usage** — bar chart
- **Error Rate Over Time** — area chart
- **Live Comparison Table** — side-by-side with best/worst annotations
- **Load Test Benchmark Results** — k6 run averages or paper Section 4 data, with weighted composite scoring across five criteria (scalability, low-load performance, security enforcement, resource efficiency, operational simplicity)

---

## API Reference

All three architectures expose identical API surfaces:

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register, returns JWT |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/data` | JWT | List documents for authenticated user |
| POST | `/api/data` | JWT | Create document |
| GET | `/api/data/:id` | JWT | Get document by ID |
| PUT | `/api/data/:id` | JWT | Update document |
| DELETE | `/api/data/:id` | JWT | Delete document |
| GET | `/api/report/summary` | JWT | Aggregate statistics |
| GET | `/api/report/activity` | JWT | Ten most recent items |
| GET | `/health` | — | Health check |
| GET | `/metrics` | — | Live performance counters |

---

## Security Comparison

| Control | Monolithic | Microservices | Hybrid |
|---|---|---|---|
| JWT validation | Per-route middleware | Per-service middleware | Gateway (centralised) |
| Token expiry enforcement | Yes | Defect in data-service | Yes |
| Rate limiting | No | No | Yes (100 req/s/IP, HTTP 429) |
| Service isolation | No | Yes | Partial |
| Single point of misconfiguration risk | Yes | No | Yes (gateway) |

---

## Limitations

- The microservices deployment uses a shared PostgreSQL instance with per-service databases rather than fully isolated database servers. This likely underestimates resource overhead of a production-grade microservices deployment.
- All tests were conducted on shared college laboratory hardware. Results should be treated as indicative rather than definitive benchmarks.
- No database-level tuning was applied. Connection pool sizes, query caches, and index configurations were left at defaults to compare architectures as-deployed.
- The hybrid gateway and application share a single physical machine, introducing CPU contention that would not occur in a deployment with dedicated infrastructure.

---

## Citation

If this repository is useful to your research, please cite the accompanying paper:

```
A Practical Comparative Study of Scalable and Secure Backend Architectures
for Resource-Constrained Web Applications.
Presented at [Conference]. [Year].
```
