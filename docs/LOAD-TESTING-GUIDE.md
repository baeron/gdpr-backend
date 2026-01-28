# Load Testing Guide

This document describes the load testing infrastructure for the GDPR Audit API, including test types, Azure DevOps pipelines, and production readiness testing procedures.

## Table of Contents

- [Overview](#overview)
- [Test Types](#test-types)
- [Test Scripts](#test-scripts)
- [Grafana Cloud k6](#grafana-cloud-k6)
- [Azure DevOps Pipelines](#azure-devops-pipelines)
- [Running Tests Locally](#running-tests-locally)
- [Running Tests on Server](#running-tests-on-server)
- [Queue Comparison Testing](#queue-comparison-testing)
- [Production Readiness Checklist](#production-readiness-checklist)
- [Interpreting Results](#interpreting-results)
- [Troubleshooting](#troubleshooting)

---

## Overview

The load testing suite uses [k6](https://k6.io/) to validate system performance under various conditions. Tests can be run:

- **Locally** against `http://localhost:3000`
- **Against Dev** at `https://api.dev.policytracker.eu`
- **Against Production** at `https://api.policytracker.eu`

### Environments

| Environment | URL | Use Case |
|-------------|-----|----------|
| Local | `http://localhost:3000` | Development testing |
| Dev | `https://api.dev.policytracker.eu` | Pre-production validation |
| Production | `https://api.policytracker.eu` | Production monitoring |

---

## Test Types

### 1. Smoke Test
**Purpose**: Quick verification that the system is functional.

| Parameter | Value |
|-----------|-------|
| Virtual Users | 5 |
| Duration | 30 seconds |
| Use Case | CI/CD, quick health check |

### 2. Load Test
**Purpose**: Validate system under expected normal to peak load.

| Parameter | Value |
|-----------|-------|
| Virtual Users | 0 → 50 → 100 |
| Duration | ~9 minutes |
| Use Case | Capacity planning, regression testing |

### 3. Stress Test
**Purpose**: Find the system's breaking point.

| Parameter | Value |
|-----------|-------|
| Virtual Users | 100 → 200 → 500 |
| Duration | ~23 minutes |
| Use Case | Identify maximum capacity |

### 4. Spike Test
**Purpose**: Validate system behavior under sudden traffic bursts.

| Parameter | Value |
|-----------|-------|
| Virtual Users | 10 → 80 → 10 → 100 |
| Duration | ~9 minutes |
| Use Case | Marketing campaigns, viral content |

**Pattern**:
1. Normal load (10 VUs)
2. Sudden spike to 80 VUs (3 min)
3. Recovery period (10 VUs)
4. Second spike to 100 VUs (3 min)
5. Ramp down

> **Note**: VUs limited to 100 for Grafana Cloud free tier. Set `MAX_VUS` env variable to override.

### 5. Soak/Endurance Test
**Purpose**: Detect memory leaks and performance degradation over time.

| Parameter | Value |
|-----------|-------|
| Virtual Users | 30 (configurable) |
| Duration | 1-4 hours |
| Use Case | Memory leak detection, stability validation |

**Key Metrics**:
- Response time trend over time
- Memory usage (via `docker stats`)
- Comparison of initial vs final response times

### 6. Breakpoint Test
**Purpose**: Find the maximum stable capacity by gradually increasing load until errors appear.

| Parameter | Value |
|-----------|-------|
| Request Rate | 5 → 10 → 20 → 30 → 50 → 75 → 100 req/s |
| Duration | ~8 minutes |
| Use Case | Capacity planning, SLA definition |

**How it works**:
1. Starts at 5 requests/second
2. Increases load every minute
3. Monitors error rate at each level
4. Identifies the point where errors start appearing

**Output**: The request rate at which errors exceed 10% is your system's breaking point.

---

## Test Scripts

All test scripts are located in `tests/load/`:

| Script | Description | Duration | Max VUs/RPS |
|--------|-------------|----------|-------------|
| `smoke.js` | Quick health check - verifies basic API functionality | 30s | 5 VUs |
| `scan-queue.js` | Full load + stress test - simulates production traffic | ~33 min | 500 VUs |
| `spike.js` | Traffic burst simulation - tests sudden load increases | ~9 min | 100 VUs |
| `soak.js` | Endurance test - detects memory leaks over time | 1-4h | 30 VUs |
| `breakpoint.js` | Capacity test - finds maximum stable throughput | ~8 min | 100 req/s |
| `queue-stats.js` | Queue monitoring - tests `/health/queue/stats` endpoint | 1 min | 10 VUs |
| `config.js` | Shared configuration - environment URLs and settings | - | - |

---

## Grafana Cloud k6

Test results can be sent to Grafana Cloud for visualization, historical comparison, and team collaboration.

### Dashboard URL

**Grafana Cloud k6 Dashboard**: [https://grafana.com/products/cloud/k6/](https://grafana.com/products/cloud/k6/)

After running tests with `--out cloud`, view results at:
```
https://<your-org>.grafana.net/a/k6-app/runs
```

### Setup

1. **Create account**: Sign up at [grafana.com](https://grafana.com/)
2. **Get API token**: Go to Grafana Cloud → k6 → Settings → API tokens
3. **Login on server**:
   ```bash
   k6 login cloud --token YOUR_API_TOKEN
   ```

### Running Tests with Cloud Output

```bash
# Smoke test with cloud output
k6 run --out cloud --env BASE_URL=http://localhost:3001 tests/load/smoke.js

# Spike test with cloud output
k6 run --out cloud --env BASE_URL=http://localhost:3001 tests/load/spike.js

# Breakpoint test with cloud output
k6 run --out cloud --env BASE_URL=http://localhost:3001 tests/load/breakpoint.js
```

### Free Tier Limits

| Limit | Value |
|-------|-------|
| Max Virtual Users | 100 VUs |
| Test duration | Unlimited |
| Data retention | 7 days |
| Concurrent tests | 1 |

> **Note**: Spike test is configured for max 100 VUs to stay within free tier limits.

### Features

- **Real-time monitoring**: Watch test execution live
- **Historical comparison**: Compare runs over time
- **Team sharing**: Share results with team members
- **Threshold alerts**: Get notified when thresholds fail
- **Export data**: Download results as CSV/JSON

### Alternative: Local JSON Output

If Grafana Cloud is not available, save results locally:

```bash
# Save to JSON file
k6 run --out json=results/smoke-$(date +%Y%m%d-%H%M).json tests/load/smoke.js

# Parse results with jq
cat results/smoke-*.json | jq '.metrics.http_req_duration.values.avg'
```

---

## Azure DevOps Pipelines

### 1. Single Load Test Pipeline

**File**: `azure-pipelines-loadtest.yml`

Runs a single load test against a specified environment and queue type.

**Parameters**:
- `scenario`: smoke, load
- `environment`: dev (prod when ready)
- `queueType`: postgres, redis
- `vus`: Custom VU count (optional)
- `duration`: Custom duration (optional)

**Artifacts**:
- `loadtest-results/` - k6 JSON output

### 2. Queue Comparison Pipeline

**File**: `azure-pipelines-loadtest-compare.yml`

Automatically compares PostgreSQL vs Redis queue performance.

**Workflow**:
1. **Setup**: Install k6, verify target health
2. **Test PostgreSQL**: Switch server to PostgreSQL, run tests
3. **Test Redis**: Switch server to Redis, run tests
4. **Restore**: Return server to PostgreSQL (default)
5. **Report**: Generate comparison markdown report

**Artifacts**:
- `postgres-results/` - PostgreSQL k6 JSON
- `redis-results/` - Redis k6 JSON
- `comparison-report/` - Markdown comparison report

### Server Queue Switching

The comparison pipeline switches queue types via SSH:

```bash
# Switch to PostgreSQL
sed -i 's/QUEUE_TYPE=.*/QUEUE_TYPE=postgres/' .env.devprod
docker stop gdpr-api-dev && docker rm gdpr-api-dev
docker run -d --name gdpr-api-dev ... --env-file .env.devprod ...

# Switch to Redis (requires REDIS_URL)
sed -i 's/QUEUE_TYPE=.*/QUEUE_TYPE=redis/' .env.devprod
echo "REDIS_URL=redis://gdpr-redis:6379" >> .env.devprod
docker stop gdpr-api-dev && docker rm gdpr-api-dev
docker run -d --name gdpr-api-dev ... --env-file .env.devprod ...
```

**Important**: The application uses `REDIS_URL` (not `REDIS_HOST`) for Redis connection.

---

## Running Tests Locally

### Prerequisites

Install k6:

**macOS**:
```bash
brew install k6
```

**Ubuntu/Debian**:
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install -y k6
```

### Running Tests

#### Console Output (Default)

```bash
# Against local dev server (localhost:3000)
k6 run tests/load/smoke.js

# Against dev environment
k6 run --env BASE_URL=https://api.dev.policytracker.eu tests/load/smoke.js
k6 run --env BASE_URL=https://api.dev.policytracker.eu tests/load/spike.js
k6 run --env BASE_URL=https://api.dev.policytracker.eu tests/load/breakpoint.js

# Soak test with custom duration and VUs
k6 run --env BASE_URL=https://api.dev.policytracker.eu \
  --env DURATION=4h --env VUS=50 tests/load/soak.js
```

#### Grafana Cloud Output

```bash
# Login first (one time)
k6 login cloud --token YOUR_API_TOKEN

# Run with cloud output
k6 run --out cloud --env BASE_URL=https://api.dev.policytracker.eu tests/load/smoke.js
k6 run --out cloud --env BASE_URL=https://api.dev.policytracker.eu tests/load/spike.js
```

#### JSON File Output

```bash
# Save results for offline analysis
k6 run --env BASE_URL=https://api.dev.policytracker.eu \
  --out json=results/spike-$(date +%Y%m%d-%H%M).json \
  tests/load/spike.js
```

---

## Running Tests on Server

### SSH to Server

```bash
ssh deploy@<VULTR_HOST>
cd /opt/gdpr-backend
```

### Pull Latest Test Scripts

```bash
git pull origin main
```

### Run Tests

#### Option 1: Console Output Only (Quick Testing)

Results displayed in terminal only. Good for quick validation and debugging.

```bash
# Smoke test (quick validation)
k6 run --env BASE_URL=http://localhost:3001 tests/load/smoke.js

# Spike test (traffic bursts)
k6 run --env BASE_URL=http://localhost:3001 tests/load/spike.js

# Breakpoint test (find max capacity)
k6 run --env BASE_URL=http://localhost:3001 tests/load/breakpoint.js

# Soak test (long-running, 1 hour)
k6 run --env BASE_URL=http://localhost:3001 tests/load/soak.js

# Full load + stress test
k6 run --env BASE_URL=http://localhost:3001 tests/load/scan-queue.js
```

#### Option 2: Grafana Cloud Output (Recommended for Analysis)

Results sent to Grafana Cloud for visualization, historical comparison, and team sharing.

> **Prerequisite**: Run `k6 login cloud --token YOUR_API_TOKEN` first.

```bash
# Smoke test with cloud output
k6 run --out cloud --env BASE_URL=http://localhost:3001 tests/load/smoke.js

# Spike test with cloud output
k6 run --out cloud --env BASE_URL=http://localhost:3001 tests/load/spike.js

# Breakpoint test with cloud output
k6 run --out cloud --env BASE_URL=http://localhost:3001 tests/load/breakpoint.js

# Soak test with cloud output (1 hour)
k6 run --out cloud --env BASE_URL=http://localhost:3001 tests/load/soak.js
```

#### Option 3: Local JSON File (Offline Analysis)

Results saved to JSON file for later analysis with `jq` or other tools.

```bash
# Create results directory
mkdir -p results

# Smoke test with JSON output
k6 run --out json=results/smoke-$(date +%Y%m%d-%H%M).json \
  --env BASE_URL=http://localhost:3001 tests/load/smoke.js

# Spike test with JSON output
k6 run --out json=results/spike-$(date +%Y%m%d-%H%M).json \
  --env BASE_URL=http://localhost:3001 tests/load/spike.js

# Parse JSON results
cat results/smoke-*.json | jq -s '.[0].metrics.http_req_duration.values'
```

### Monitor During Tests

```bash
# Container resource usage
docker stats

# API logs
docker logs gdpr-api-dev --tail 100 -f

# Queue stats
curl -s http://localhost:3001/api/health/queue/stats | jq

# PostgreSQL connections
docker exec gdpr-postgres psql -U gdpr_dev -d gdpr_audit -c \
  "SELECT count(*) FROM pg_stat_activity;"

# Redis stats (if using Redis)
docker exec gdpr-redis redis-cli INFO stats
```

---

## Queue Comparison Testing

### Manual Comparison

#### Test PostgreSQL Queue

```bash
# Ensure PostgreSQL queue is active
grep QUEUE_TYPE .env.devprod  # Should show: QUEUE_TYPE=postgres

# Run test
k6 run --env BASE_URL=http://localhost:3001 \
  --out json=results/postgres.json \
  tests/load/smoke.js
```

#### Switch to Redis Queue

```bash
# Update environment
sed -i 's/QUEUE_TYPE=.*/QUEUE_TYPE=redis/' .env.devprod

# Add REDIS_URL if not present
grep -q "REDIS_URL" .env.devprod || echo "REDIS_URL=redis://gdpr-redis:6379" >> .env.devprod

# Recreate container (restart won't pick up env changes!)
docker stop gdpr-api-dev && docker rm gdpr-api-dev
docker run -d \
  --name gdpr-api-dev \
  --network gdpr-backend_default \
  -p 127.0.0.1:3001:3000 \
  --env-file .env.devprod \
  -e DATABASE_URL="postgresql://gdpr_dev:gdpr_dev@gdpr-postgres:5432/gdpr_audit?schema=dev" \
  gdpr-backend_api-dev \
  sh -c "npx prisma migrate deploy && npm run start:prod"

# Wait for healthy
curl -s http://localhost:3001/api/health

# Run test
k6 run --env BASE_URL=http://localhost:3001 \
  --out json=results/redis.json \
  tests/load/smoke.js
```

#### Restore PostgreSQL

```bash
sed -i 's/QUEUE_TYPE=.*/QUEUE_TYPE=postgres/' .env.devprod
docker stop gdpr-api-dev && docker rm gdpr-api-dev
docker run -d ... (same as above)
```

### Key Findings: PostgreSQL vs Redis/BullMQ

**Test Date**: 2026-01-28  
**Environment**: Dev (api.dev.policytracker.eu)  

#### Breakpoint Test Comparison

| Metric | PostgreSQL | Redis/BullMQ | Improvement |
|--------|------------|--------------|-------------|
| Error Rate | 1.21% | **0.00%** | ♾️ better |
| p95 Response | 8.08s | **136ms** | **60x faster** |
| Median Response | 11ms | **8ms** | 1.4x faster |
| Throughput | 29 req/s | **36 req/s** | 1.25x higher |
| Max VUs needed | ~100 | **25** | 4x more efficient |

#### Soak Test Comparison (1 hour, 30 VUs)

| Metric | PostgreSQL | Redis/BullMQ | Improvement |
|--------|------------|--------------|-------------|
| Error Rate | 5.38% ❌ | **0.00%** ✅ | ♾️ better |
| HTTP Failed | 5.37% ❌ | **0.00%** ✅ | ♾️ better |
| p95 Response | 237ms | **58ms** | **4x faster** |
| Success Rate | 94.62% | **100%** | Perfect |
| Failed Jobs | 24,555 | **2** | **12,000x fewer** |
| Throughput | 33 req/s | **35 req/s** | 1.06x higher |

**Conclusion**: **Redis/BullMQ is significantly better** for production:
- Zero errors under sustained load
- 4-60x faster response times
- Near-zero failed jobs (2 vs 24,555)
- More efficient VU usage

**Recommendation**: Use Redis/BullMQ for production deployments.

---

## Load Test Results (January 2026)

### Breakpoint Test Results

**Test Date**: 2026-01-27  
**Environment**: Dev (api.dev.policytracker.eu)  
**Endpoint**: `/api/scanner/queue` (async)

#### Summary

| Metric | Value | Status |
|--------|-------|--------|
| Error Rate | 1.21% | ✅ Pass (<10%) |
| p95 Response Time | 8.08s | ⚠️ Under heavy load |
| Median Response Time | 11ms | ✅ Excellent |
| Throughput | 29 req/s | ✅ Good |
| Total Requests | 14,348 | - |
| Success Rate | 98.78% | ✅ Excellent |

#### Capacity Limits

| Load Level | req/s | Performance | Recommendation |
|------------|-------|-------------|----------------|
| Light | 0-30 | ✅ Stable, <100ms | Safe for production |
| Medium | 30-50 | ⚠️ Some delays | Monitor closely |
| Heavy | 50-75 | ⚠️ p95 ~4-5s | Scale if needed |
| Stress | 75-100 | ❌ p95 ~8s | Not recommended |

#### Before vs After (Sync vs Async)

| Metric | Sync `/scan` | Async `/queue` | Improvement |
|--------|--------------|----------------|-------------|
| Error Rate | 71.93% | 1.21% | **60x better** |
| p95 Response | 30s | 8s (med: 11ms) | **~3x better** |
| Throughput | ~5 req/s | ~29 req/s | **6x better** |
| Success Rate | 18% | 98.78% | **5x better** |

#### Recommendations

1. **Use async endpoint** (`/api/scanner/queue`) for all production traffic
2. **Use Redis/BullMQ** for queue management (significantly better performance)
3. **Safe capacity**: Up to 36 concurrent requests/second with Redis
4. **Scaling options**:
   - Increase `MAX_CONCURRENT_SCANS` from 1 to 3 (adds ~300-600MB RAM per instance)
   - Add horizontal scaling (multiple API instances)

### Redis/BullMQ Test Results (2026-01-28)

#### Breakpoint Test

| Metric | Value | Status |
|--------|-------|--------|
| Error Rate | 0.00% | ✅ Perfect |
| p95 Response | 136ms | ✅ Excellent |
| Avg Response | 25ms | ✅ Excellent |
| Median Response | 8ms | ✅ Excellent |
| Throughput | 36 req/s | ✅ Excellent |
| Success Rate | 100% | ✅ Perfect |

#### Soak Test (1 hour)

| Metric | Value | Status |
|--------|-------|--------|
| Error Rate | 0.00% | ✅ Perfect |
| HTTP Failed | 0.00% | ✅ Perfect |
| p95 Response | 58ms | ✅ Excellent |
| Health Check p99 | 16ms | ✅ Excellent |
| Success Rate | 100% | ✅ Perfect |
| Failed Jobs | 2 out of 42,365 | ✅ 0.005% |

**Key Takeaway**: Redis/BullMQ maintained perfect stability for 1 hour with zero errors and consistent response times.

---

## Production Readiness Checklist

Before production launch, complete these tests:

### Phase 1: Basic Validation
- [ ] Smoke test passes on dev
- [ ] Smoke test passes on prod
- [ ] All health endpoints respond < 500ms

### Phase 2: Load Testing
- [ ] Run full load test (`scan-queue.js`) on dev
- [ ] Identify maximum VU before errors > 5%
- [ ] Document baseline performance metrics

### Phase 3: Spike Testing
- [ ] Run spike test on dev
- [ ] Verify system recovers after traffic spikes
- [ ] No memory growth during spikes

### Phase 4: Endurance Testing
- [ ] Run soak test for 1+ hours on dev
- [ ] Compare start vs end response times
- [ ] No memory leaks detected (< 2x degradation)

### Phase 5: Production Validation
- [ ] Run smoke test on prod (off-peak hours)
- [ ] Run limited spike test on prod (50 VUs max)
- [ ] Monitor APM/logs for anomalies

---

## Interpreting Results

### Key Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| `http_req_duration` | Total request time | p95 < 5s |
| `http_req_failed` | Request failure rate | < 1% (smoke), < 5% (load) |
| `http_reqs` | Requests per second | Baseline + 20% |
| `vus` | Active virtual users | As specified |

### Thresholds by Test Type

| Test Type | p95 Response | Error Rate |
|-----------|--------------|------------|
| Smoke | < 1s | < 1% |
| Load | < 2s | < 5% |
| Stress | < 5s | < 10% |
| Spike | < 10s | < 15% |
| Soak | < 5s | < 2% |

### Warning Signs

- **Response time increasing over time**: Possible memory leak
- **Error rate spikes at specific VU count**: Capacity limit reached
- **Timeout errors**: Database connection pool exhaustion
- **503 errors**: Server overloaded, consider scaling

---

## Troubleshooting

### "Target is not healthy (HTTP 000)"

DNS or network issue:
```bash
# Verify DNS resolution
nslookup api.dev.policytracker.eu

# Test connectivity
curl -v https://api.dev.policytracker.eu/api/health
```

### "ECONNREFUSED 127.0.0.1:6379"

Redis URL not configured:
```bash
# Check current config
grep REDIS .env.devprod

# Add REDIS_URL (not REDIS_HOST!)
echo "REDIS_URL=redis://gdpr-redis:6379" >> .env.devprod

# Recreate container
docker stop gdpr-api-dev && docker rm gdpr-api-dev
docker run -d ... --env-file .env.devprod ...
```

### "docker-compose restart" doesn't apply env changes

Docker restart doesn't re-read env files. Must recreate container:
```bash
docker stop gdpr-api-dev
docker rm gdpr-api-dev
docker run -d ... --env-file .env.devprod ...
```

### High Error Rate During Tests

1. Check server resources: `htop`, `docker stats`
2. Check database connections
3. Reduce VU count
4. Check for rate limiting

### Queue Overflow / Too Many Queued Jobs

After load testing, the queue may have thousands of pending jobs. Clear before next test:

```bash
# Check current queue status
curl -s http://localhost:3001/api/health/queue/stats | jq

# Clear the queue (dev schema)
docker exec gdpr-postgres psql -U gdpr -d gdpr_audit -c \
  'SET search_path TO dev; TRUNCATE "ScanJob" CASCADE;'

# Verify queue is empty
curl -s http://localhost:3001/api/health/queue/stats | jq
```

> **Note**: The database uses schema `dev` for the development environment. Always specify `SET search_path TO dev;` before TRUNCATE.

### Queue Stats Not Updating After TRUNCATE

The stats may be cached in memory. Restart the API container:

```bash
docker restart gdpr-api-dev
sleep 15
curl -s http://localhost:3001/api/health/queue/stats | jq
```

### Increase Queue Processing Speed

If queue is processing too slowly (`maxConcurrent: 1`):

```bash
# Check current setting
grep MAX_CONCURRENT .env.devprod

# Increase concurrent scans (add or update)
echo "MAX_CONCURRENT_SCANS=3" >> .env.devprod

# Recreate container to apply
docker stop gdpr-api-dev && docker rm gdpr-api-dev
docker run -d --name gdpr-api-dev ... --env-file .env.devprod ...
```

### Test File Not Found on Server

```bash
# Pull latest changes
cd /opt/gdpr-backend
git pull origin main

# Verify file exists
ls -la tests/load/
```

---

## References

- [k6 Documentation](https://k6.io/docs/)
- [k6 Thresholds](https://k6.io/docs/using-k6/thresholds/)
- [Load Testing Best Practices](https://k6.io/docs/testing-guides/load-testing-websites/)
- [Azure DevOps Pipelines](https://docs.microsoft.com/en-us/azure/devops/pipelines/)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-28 | Added Redis/BullMQ test results (breakpoint + soak) |
| 2026-01-28 | Updated PostgreSQL vs Redis comparison with real data |
| 2026-01-28 | Added queue management troubleshooting (clear queue, increase concurrency) |
| 2026-01-28 | Added Grafana Cloud k6 integration section |
| 2026-01-28 | Added breakpoint.js test documentation |
| 2026-01-28 | Updated spike test VUs to 100 (Grafana Cloud free tier limit) |
| 2026-01-28 | Enhanced test script descriptions |
| 2026-01-27 | Added breakpoint test results and capacity recommendations |
| 2026-01-24 | Added spike.js and soak.js tests |
| 2026-01-24 | Fixed queue switching scripts (REDIS_URL, container recreation) |
| 2026-01-24 | Fixed dev URL (api.dev vs dev.api) |
| 2026-01-24 | Added production readiness checklist |
