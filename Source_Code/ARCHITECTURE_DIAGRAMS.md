# Architecture Diagrams — eraser.io

Go to https://app.eraser.io → New Diagram → Cloud Architecture Diagram, then paste each code block.

---

## 1. Monolithic Architecture

```
direction right
colorMode bold

Client [icon: user, color: grey, label: "Browser / k6"]

MonoApp [color: blue, label: "Monolithic Node.js App  :3001"] {
  JWTMiddleware [icon: shield, color: blue, label: "JWT Middleware"]
  AuthRouter [icon: server, color: blue, label: "Auth Router"]
  DataRouter [icon: server, color: blue, label: "Data Router"]
  ReportRouter [icon: server, color: blue, label: "Report Router"]
}

PostgresMono [icon: database, color: blue, label: "PostgreSQL  mono_db"]

Client > MonoApp: "HTTP REST"
JWTMiddleware > AuthRouter
JWTMiddleware > DataRouter
JWTMiddleware > ReportRouter
AuthRouter > PostgresMono: "users table"
DataRouter > PostgresMono: "documents table"
ReportRouter > PostgresMono: "aggregation"
```

---

## 2. Microservices Architecture

```
direction right
colorMode bold

Client [icon: user, color: grey, label: "Browser / k6"]

Gateway [icon: server, color: orange, label: "API Gateway  :3002  JWT Guard + Proxy"]

Services [color: orange, label: "Docker Bridge Network"] {
  AuthService [icon: docker, color: orange, label: "Auth Service  :3011"]
  DataService [icon: docker, color: orange, label: "Data Service  :3012"]
  ReportService [icon: docker, color: orange, label: "Report Service  :3013"]
}

PostgresMS [icon: database, color: orange, label: "PostgreSQL  ms_db"]

Client > Gateway: "HTTP REST"
Gateway > AuthService: "/api/auth  +20-35ms"
Gateway > DataService: "/api/data  +20-35ms"
Gateway > ReportService: "/api/report  +20-35ms"
ReportService > DataService: "internal GET /api/data"
AuthService > PostgresMS: "users table"
DataService > PostgresMS: "documents table"
```

---

## 3. Hybrid Architecture

```
direction right
colorMode bold

Client [icon: user, color: grey, label: "Browser / k6"]

GatewayLayer [color: green, label: "Gateway Layer  :3003"] {
  RateLimiter [icon: shield, color: green, label: "Rate Limiter  100 req/s/IP"]
  JWTCheck [icon: shield, color: green, label: "JWT Validation  centralised"]
  Proxy [icon: server, color: green, label: "Reverse Proxy"]
}

AppLayer [color: teal, label: "Monolithic App  :3021"] {
  AuthRouter [icon: server, color: teal, label: "Auth Router"]
  DataRouter [icon: server, color: teal, label: "Data Router"]
  ReportRouter [icon: server, color: teal, label: "Report Router"]
}

PostgresHybrid [icon: database, color: teal, label: "PostgreSQL  hybrid_db"]

Client > RateLimiter: "HTTP"
RateLimiter > JWTCheck: "allowed"
JWTCheck > Proxy: "verified  +18-30ms"
Proxy > AuthRouter: "pre-validated"
Proxy > DataRouter: "pre-validated"
Proxy > ReportRouter: "pre-validated"
AuthRouter > PostgresHybrid: "SQL"
DataRouter > PostgresHybrid: "SQL"
ReportRouter > PostgresHybrid: "SQL"
```

---

## 4. All Three Architectures Side-by-Side

```
direction down
colorMode bold

Client [icon: user, color: grey, label: "Browser / k6  (load generator)"]

MonoApp [color: blue, label: "Monolithic  :3001"] {
  MonoLogic [icon: server, color: blue, label: "Express App  auth + data + report"]
  MonoDB [icon: database, color: blue, label: "PostgreSQL  mono_db"]
}

MSGateway [color: orange, label: "Microservices  :3002"] {
  Gateway [icon: server, color: orange, label: "API Gateway"]
  AuthSvc [icon: docker, color: orange, label: "Auth  :3011"]
  DataSvc [icon: docker, color: orange, label: "Data  :3012"]
  ReportSvc [icon: docker, color: orange, label: "Report  :3013"]
  MSDB [icon: database, color: orange, label: "PostgreSQL  ms_db"]
}

HybridGW [color: green, label: "Hybrid  :3003"] {
  NGINXGateway [icon: server, color: green, label: "Gateway  JWT + rate-limit"]
  HybridApp [icon: server, color: teal, label: "Monolithic App  :3021"]
  HybridDB [icon: database, color: teal, label: "PostgreSQL  hybrid_db"]
}

Client > MonoApp: "50 VU: 42ms avg  500 VU: 1347ms avg"
Client > MSGateway: "50 VU: 63ms avg  500 VU: 188ms avg"
Client > HybridGW: "50 VU: 55ms avg  500 VU: 258ms avg"
```

---

## 5. Load Test Workload per Virtual User

> Paste into a **Flow Chart** diagram (not Cloud Architecture).

```
Start > Register: "POST /api/auth/register"
Register > Login: "POST /api/auth/login"
Login > Write1: "JWT token received"
Write1 > Write2
Write2 > Write3
Write3 > Write4
Write4 > Write5: "POST /api/data  x5 total"
Write5 > Report1: "GET /api/report/summary"
Report1 > Report2: "GET /api/report/summary"
Report2 > Start: "next iteration  8 calls total"
```
