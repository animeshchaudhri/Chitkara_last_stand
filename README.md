# 🏗️ Backend Architecture Comparative Study

> **Paper:** *A Practical Comparative Study of Scalable and Secure Backend Architectures for Resource-Constrained Web Applications*

Three fully working Node.js backends + a live React dashboard + k6 load tests, all in one repo.

---

## 📁 Project Structure

```
Gay_chitkara/
├── monolithic/          ← Single Node.js app (Port 3001)
│   └── src/
│       ├── index.js     ← Express app + metrics endpoint
│       ├── db.js        ← In-memory stores (PostgreSQL / MongoDB sim)
│       ├── middleware/auth.js
│       └── routes/ auth | data | report
│
├── microservices/       ← 4 independent services
│   ├── gateway/         ← API Gateway (Port 3002)
│   ├── auth-service/    ← Authentication (Port 3011)
│   ├── data-service/    ← Document CRUD (Port 3012)
│   ├── report-service/  ← Reporting (Port 3013)
│   └── docker-compose.yml
│
├── hybrid/              ← Gateway + monolithic app
│   ├── gateway/         ← Smart GW: rate limit, JWT, routing (Port 3003)
│   ├── app/             ← Backend app (Port 3021)
│   └── docker-compose.yml
│
├── dashboard/           ← React + Recharts dashboard (Port 5173)
│   └── src/
│       ├── App.jsx
│       └── components/
│           ├── MetricsOverview.jsx   ← Live stat cards per architecture
│           ├── ResponseTimeChart.jsx ← Real-time line chart
│           ├── ThroughputGauge.jsx   ← RPM bar chart
│           └── ComparisonTable.jsx   ← Best/Worst badges
│
├── load-tests/          ← k6 scripts
│   ├── monolithic-test.js
│   ├── microservices-test.js
│   ├── hybrid-test.js
│   └── run-all-tests.sh
│
└── docker-compose.yml   ← Master — starts everything
```

---

## 🚀 Quick Start

### Option A — Docker (recommended)

```bash
# Start all three architectures at once
docker compose up --build

# Services:
#   Monolithic       → http://localhost:3001
#   Microservices GW → http://localhost:3002
#   Hybrid GW        → http://localhost:3003
```

### Option B — Local (without Docker)

```bash
# Terminal 1 — Monolithic
cd monolithic && npm install && npm start

# Terminal 2 — Microservices (start all 4)
cd microservices/auth-service    && npm install && npm start &
cd microservices/data-service    && npm install && npm start &
cd microservices/report-service  && npm install && npm start &
cd microservices/gateway         && npm install && npm start

# Terminal 3 — Hybrid
cd hybrid/app     && npm install && npm start &
cd hybrid/gateway && npm install && npm start

# Terminal 4 — Dashboard
cd dashboard && npm install && npm run dev
```

---

## 📊 Dashboard

```bash
cd dashboard
npm install
npm run dev
# Open http://localhost:5173
```

The dashboard auto-polls all three `/metrics` endpoints every **3 seconds** and shows:

| Widget | What it shows |
|---|---|
| **Architecture Cards** | Live stats per backend (response time, RPM, error rate, memory) |
| **Response Time Chart** | Rolling line graph comparing avg latency over time |
| **Throughput Gauge** | Bar chart of requests/minute per architecture |
| **Comparison Table** | Side-by-side table with ✓ Best / ⚠ Worst badges |

---

## 🔥 Load Testing with k6

### Install k6

```bash
# Ubuntu / Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
     --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
     | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# macOS
brew install k6
```

### Run individual tests

```bash
# While all backends are running:
k6 run load-tests/monolithic-test.js
k6 run load-tests/microservices-test.js
k6 run load-tests/hybrid-test.js
```

### Run all tests sequentially + save results

```bash
chmod +x load-tests/run-all-tests.sh
bash load-tests/run-all-tests.sh
# Results saved to load-tests/results/
```

### Load test stages

| Phase | Duration | Virtual Users |
|---|---|---|
| Ramp up | 30 s | 0 → 20 |
| Steady state | 60 s | 20 |
| Stress | 30 s | 20 → 50 |
| Peak | 30 s | 50 |
| Ramp down | 30 s | 50 → 0 |

---

## 🌐 API Endpoints (all three architectures)

| Method | Path | Auth required | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register a new user |
| POST | `/api/auth/login` | No | Login → JWT |
| GET | `/api/data` | JWT | List user documents |
| POST | `/api/data` | JWT | Create document |
| GET | `/api/data/:id` | JWT | Get single document |
| PUT | `/api/data/:id` | JWT | Update document |
| DELETE | `/api/data/:id` | JWT | Delete document |
| GET | `/api/report/summary` | JWT | Aggregate summary |
| GET | `/api/report/activity` | JWT | Recent 10 items |
| GET | `/health` | No | Service health check |
| GET | `/metrics` | No | JSON performance metrics |

---

## 🔐 Security Features

| Feature | Monolithic | Microservices | Hybrid |
|---|---|---|---|
| JWT Auth | ✅ | ✅ | ✅ |
| Rate Limiting | ❌ | ❌ | ✅ Gateway |
| Auth Rate Limit (15 min) | ❌ | ❌ | ✅ |
| Service Isolation | ❌ | ✅ | Partial |
| Central Auth Policy | ❌ | ❌ | ✅ |

---

## 📐 Architecture Diagrams

### Monolithic
```
Client → Express App (3001)
              ├── /api/auth  (bcrypt + JWT)
              ├── /api/data  (in-memory store)
              └── /api/report
```

### Microservices
```
Client → Gateway (3002)
              ├── /api/auth   → Auth Service (3011)
              ├── /api/data   → Data Service (3012)
              └── /api/report → Report Service (3013)
                                     ↓ calls
                               Data Service (3012)
```

### Hybrid
```
Client → Smart Gateway (3003)
         │  ├── JWT validation
         │  ├── Rate limiting (global 200/min + auth 20/15min)
         │  └── Header injection (x-user-id, x-username)
         └──→ App (3021)
                ├── /api/auth
                ├── /api/data
                └── /api/report
```

---

## 📄 Research Context

This project implements the experimental study described in:

> *"A Practical Comparative Study of Scalable and Secure Backend Architectures for Resource-Constrained Web Applications"*

**Expected findings:**
- Monolithic: lowest overhead, best for low–moderate load
- Microservices: +20–30% resource consumption, best fault isolation
- Hybrid: balanced performance + centralized security via gateway
