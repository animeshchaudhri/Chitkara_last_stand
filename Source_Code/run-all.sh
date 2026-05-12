#!/bin/bash

set -e

echo "🚀 Starting Architecture Comparison Stack..."
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
  local port=$1
  local name=$2
  if lsof -i :$port > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port $port (${name}) is already in use${NC}"
    return 0
  fi
  return 1
}

# Function to check if container exists and running
check_container() {
  local container=$1
  if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
    docker rm -f "$container" 2>/dev/null || true
    echo -e "${YELLOW}Removed existing ${container} container${NC}"
  fi
}

# Check Docker
if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker is not installed${NC}"
  exit 1
fi

# Start PostgreSQL containers
echo -e "${YELLOW}📦 Starting PostgreSQL containers...${NC}"

check_container "mono-postgres"
check_container "ms-postgres"
check_container "hybrid-postgres"

docker run -d \
  --name mono-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=mono_db \
  -p 5433:5432 \
  postgres:16-alpine > /dev/null
echo -e "${GREEN}✓ mono-postgres${NC} (port 5433)"

docker run -d \
  --name ms-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ms_db \
  -p 5434:5432 \
  postgres:16-alpine > /dev/null
echo -e "${GREEN}✓ ms-postgres${NC} (port 5434)"

docker run -d \
  --name hybrid-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=hybrid_db \
  -p 5435:5432 \
  postgres:16-alpine > /dev/null
echo -e "${GREEN}✓ hybrid-postgres${NC} (port 5435)"

echo ""
echo -e "${YELLOW}⏳ Waiting for Postgres to be ready (15 seconds)...${NC}"
sleep 15

# Install dependencies if not already done
echo ""
echo -e "${YELLOW}📦 Installing dependencies...${NC}"

if [ ! -d "monolithic/node_modules" ]; then
  echo "Installing monolithic dependencies..."
  cd monolithic && npm install > /dev/null 2>&1 && cd ..
fi

if [ ! -d "microservices/gateway/node_modules" ]; then
  echo "Installing microservices dependencies..."
  cd microservices/gateway && npm install > /dev/null 2>&1 && cd ../..
  cd microservices/auth-service && npm install > /dev/null 2>&1 && cd ../..
  cd microservices/data-service && npm install > /dev/null 2>&1 && cd ../..
fi

if [ ! -d "hybrid/gateway/node_modules" ]; then
  echo "Installing hybrid dependencies..."
  cd hybrid/gateway && npm install > /dev/null 2>&1 && cd ../..
  cd hybrid/app && npm install > /dev/null 2>&1 && cd ../..
fi

echo -e "${GREEN}✓ Dependencies ready${NC}"
echo ""

# Start services
echo -e "${YELLOW}🎯 Starting services...${NC}"
echo ""

# Create logs directory
mkdir -p logs

# Monolithic
echo -e "${YELLOW}Monolithic (port 3001)${NC}"
cd monolithic
POSTGRES_PORT=5433 POSTGRES_DB=mono_db npm start > ../logs/monolithic.log 2>&1 &
MONO_PID=$!
cd ..
echo -e "${GREEN}✓ Started (PID: $MONO_PID)${NC}"
sleep 2

# Microservices
echo -e "${YELLOW}Microservices Gateway (port 3002)${NC}"
cd microservices/gateway
npm start > ../../logs/ms-gateway.log 2>&1 &
GATEWAY_PID=$!
cd ../..
echo -e "${GREEN}✓ Started (PID: $GATEWAY_PID)${NC}"
sleep 2

echo -e "${YELLOW}Auth Service (port 3011)${NC}"
cd microservices/auth-service
POSTGRES_PORT=5434 POSTGRES_DB=ms_db npm start > ../../logs/auth-service.log 2>&1 &
AUTH_PID=$!
cd ../..
echo -e "${GREEN}✓ Started (PID: $AUTH_PID)${NC}"
sleep 1

echo -e "${YELLOW}Data Service (port 3012)${NC}"
cd microservices/data-service
POSTGRES_PORT=5434 POSTGRES_DB=ms_db npm start > ../../logs/data-service.log 2>&1 &
DATA_PID=$!
cd ../..
echo -e "${GREEN}✓ Started (PID: $DATA_PID)${NC}"
sleep 2

# Hybrid
echo -e "${YELLOW}Hybrid Gateway (port 3003)${NC}"
cd hybrid/gateway
npm start > ../../logs/hybrid-gateway.log 2>&1 &
HYB_GATEWAY_PID=$!
cd ../..
echo -e "${GREEN}✓ Started (PID: $HYB_GATEWAY_PID)${NC}"
sleep 2

echo -e "${YELLOW}Hybrid App (port 3021)${NC}"
cd hybrid/app
POSTGRES_PORT=5435 POSTGRES_DB=hybrid_db npm start > ../../logs/hybrid-app.log 2>&1 &
HYB_APP_PID=$!
cd ../..
echo -e "${GREEN}✓ Started (PID: $HYB_APP_PID)${NC}"
sleep 2

echo ""
echo -e "${GREEN}✅ All services started!${NC}"

# Wait a few extra seconds for services to finish DB init before hammering them
echo ""
echo -e "${YELLOW}⏳ Waiting 8s for services to fully initialise...${NC}"
sleep 8

# Start background load generator (30 VUs per service)
echo -e "${YELLOW}⚡ Starting live load generator (30 VUs × 3 services)...${NC}"
VUS=30 node load-tests/live-load.js > logs/live-load.log 2>&1 &
LOAD_PID=$!
echo -e "${GREEN}✓ Live load running (PID: $LOAD_PID) — logs: ./logs/live-load.log${NC}"

echo ""
echo -e "${YELLOW}📊 Services Running:${NC}"
echo "  Monolithic:          http://localhost:3001"
echo "  Microservices GW:    http://localhost:3002"
echo "  Microservices Auth:  http://localhost:3011"
echo "  Microservices Data:  http://localhost:3012"
echo "  Hybrid GW:           http://localhost:3003"
echo "  Hybrid App:          http://localhost:3021"
echo "  Dashboard:           http://localhost:5173"
echo ""
echo -e "${YELLOW}🗄️  PostgreSQL Databases:${NC}"
echo "  Monolithic:  localhost:5433 (mono_db)"
echo "  Microservices: localhost:5434 (ms_db)"
echo "  Hybrid:      localhost:5435 (hybrid_db)"
echo ""
echo -e "${YELLOW}📋 Logs available in ./logs/${NC}"
echo "  ./logs/live-load.log   ← background traffic stats"
echo ""
echo -e "${YELLOW}To stop everything:${NC}"
echo "  pkill -f 'live-load.js' && pkill -f 'npm start' && docker stop mono-postgres ms-postgres hybrid-postgres"
echo ""
