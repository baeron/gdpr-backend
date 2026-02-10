# Load Testing Wiki

> **Last Updated**: January 2026  
> **Status**: Production Ready  
> **Tool**: k6 (Grafana)

---

## Quick Start

### Prerequisites

```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo apt-get install k6
```

### Run Your First Test

```bash
# Smoke test (30 seconds)
k6 run tests/load/smoke.js

# Against Dev environment
k6 run --env BASE_URL=https://api.dev.policytracker.eu tests/load/smoke.js
```

---

## Overview

The GDPR Audit API uses [k6](https://k6.io/) for load testing. Tests validate system performance under various conditions including normal load, traffic spikes, and sustained usage.

### Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| Local | `http://localhost:3000` | Development |
| Dev | `https://api.dev.policytracker.eu` | Pre-production |
| Production | `https://api.policytracker.eu` | Live monitoring |

---

## Test Types

| Test | VUs | Duration | Purpose |
|------|-----|----------|---------|
| **Smoke** | 5 | 30s | Quick health check |
| **Load** | 50-100 | 9 min | Normal traffic simulation |
| **Stress** | 100-500 | 23 min | Find breaking point |
| **Spike** | 10→100 | 9 min | Traffic burst handling |
| **Soak** | 30 | 1-4 hours | Memory leak detection |
| **Breakpoint** | 5-100 req/s | 8 min | Maximum capacity |

### Test Scripts

All scripts located in `tests/load/`:

| Script | Description |
|--------|-------------|
| `smoke.js` | Basic API functionality verification |
| `scan-queue.js` | Full load + stress test |
| `spike.js` | Traffic burst simulation |
| `soak.js` | Long-running endurance test |
| `breakpoint.js` | Find maximum throughput |
| `queue-stats.js` | Queue health monitoring |
| `config.js` | Shared configuration |

---

## Running Tests

### Local Development

```bash
# Basic smoke test
k6 run tests/load/smoke.js

# Against dev environment
k6 run --env BASE_URL=https://api.dev.policytracker.eu tests/load/smoke.js

# Custom duration soak test
k6 run --env BASE_URL=https://api.dev.policytracker.eu \
  --env DURATION=4h --env VUS=50 tests/load/soak.js
```

### On Server

```bash
# SSH to server
ssh deploy@<VULTR_HOST>
cd /opt/gdpr-backend

# Pull latest test scripts
git pull origin main

# Run tests
k6 run --env BASE_URL=http://localhost:3001 tests/load/smoke.js
k6 run --env BASE_URL=http://localhost:3001 tests/load/spike.js
k6 run --env BASE_URL=http://localhost:3001 tests/load/breakpoint.js
```

### Output Options

| Option | Command | Use Case |
|--------|---------|----------|
| Console | `k6 run tests/load/smoke.js` | Quick debugging |
| Grafana Cloud | `k6 run --out cloud tests/load/smoke.js` | Team sharing, historical comparison |
| JSON File | `k6 run --out json=results/test.json tests/load/smoke.js` | Offline analysis |

---

## Grafana Cloud Integration

### Setup

1. Create account at [grafana.com](https://grafana.com/)
2. Get API token: Grafana Cloud → k6 → Settings → API tokens
3. Login: `k6 login cloud --token YOUR_API_TOKEN`

### Free Tier Limits

| Limit | Value |
|-------|-------|
| Max VUs | 100 |
| Duration | Unlimited |
| Data retention | 7 days |
| Concurrent tests | 1 |

### Running with Cloud Output

```bash
k6 run --out cloud --env BASE_URL=http://localhost:3001 tests/load/smoke.js
```

---

## Queue Comparison: PostgreSQL vs Redis/BullMQ

### Test Results (January 2026)

| Metric | PostgreSQL | Redis/BullMQ | Improvement |
|--------|------------|--------------|-------------|
| **Error Rate** | 1.21% | **0.00%** | ∞ better |
| **p95 Response** | 8.08s | **136ms** | **60x faster** |
| **Median Response** | 11ms | **8ms** | 1.4x faster |
| **Throughput** | 29 req/s | **36 req/s** | 1.25x higher |

### Soak Test (1 hour, 30 VUs)

| Metric | PostgreSQL | Redis/BullMQ |
|--------|------------|--------------|
| Error Rate | 5.38% ❌ | **0.00%** ✅ |
| p95 Response | 237ms | **58ms** |
| Failed Jobs | 24,555 | **2** |
| Success Rate | 94.62% | **100%** |

> **Recommendation**: Use **Redis/BullMQ** for production deployments.

### Switching Queue Types

```bash
# Switch to Redis
sed -i 's/QUEUE_TYPE=.*/QUEUE_TYPE=redis/' .env.devprod
echo "REDIS_URL=redis://gdpr-redis:6379" >> .env.devprod

# Recreate container (restart won't apply env changes!)
docker stop gdpr-api-dev && docker rm gdpr-api-dev
docker run -d --name gdpr-api-dev \
  --network gdpr-backend_default \
  -p 127.0.0.1:3001:3000 \
  --env-file .env.devprod \
  -e DATABASE_URL="postgresql://gdpr_dev:gdpr_dev@gdpr-postgres:5432/gdpr_audit?schema=dev" \
  gdpr-backend_api-dev \
  sh -c "npx prisma migrate deploy && npm run start:prod"
```

---

## Performance Thresholds

### By Test Type

| Test | p95 Response | Error Rate |
|------|--------------|------------|
| Smoke | < 1s | < 1% |
| Load | < 2s | < 5% |
| Stress | < 5s | < 10% |
| Spike | < 10s | < 15% |
| Soak | < 5s | < 2% |

### Capacity Limits (Redis/BullMQ)

| Load Level | req/s | Status |
|------------|-------|--------|
| Light | 0-30 | ✅ Safe for production |
| Medium | 30-50 | ⚠️ Monitor closely |
| Heavy | 50-75 | ⚠️ Scale if needed |
| Stress | 75-100 | ❌ Not recommended |

---

## Monitoring During Tests

```bash
# Container resources
docker stats

# API logs
docker logs gdpr-api-dev --tail 100 -f

# Queue stats
curl -s http://localhost:3001/api/health/queue/stats | jq

# PostgreSQL connections
docker exec gdpr-postgres psql -U gdpr_dev -d gdpr_audit -c \
  "SELECT count(*) FROM pg_stat_activity;"

# Redis stats
docker exec gdpr-redis redis-cli INFO stats
```

---

## Production Readiness Checklist

### Phase 1: Basic Validation
- [ ] Smoke test passes on dev
- [ ] Smoke test passes on prod
- [ ] All health endpoints respond < 500ms

### Phase 2: Load Testing
- [ ] Run full load test on dev
- [ ] Identify maximum VU before errors > 5%
- [ ] Document baseline metrics

### Phase 3: Spike Testing
- [ ] Run spike test on dev
- [ ] Verify system recovers after spikes
- [ ] No memory growth during spikes

### Phase 4: Endurance Testing
- [ ] Run soak test for 1+ hours
- [ ] Compare start vs end response times
- [ ] No memory leaks (< 2x degradation)

### Phase 5: Production Validation
- [ ] Run smoke test on prod (off-peak)
- [ ] Run limited spike test (50 VUs max)
- [ ] Monitor APM/logs for anomalies

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `HTTP 000` | DNS/network issue | Check `nslookup` and `curl -v` |
| `ECONNREFUSED :6379` | Redis URL missing | Add `REDIS_URL=redis://gdpr-redis:6379` |
| Env changes not applied | Used `docker restart` | Must recreate container |
| High error rate | Server overloaded | Reduce VUs, check `docker stats` |

### Clear Queue After Testing

```bash
# Check queue status
curl -s http://localhost:3001/api/health/queue/stats | jq

# Clear queue (dev schema)
docker exec gdpr-postgres psql -U gdpr -d gdpr_audit -c \
  'SET search_path TO dev; TRUNCATE "ScanJob" CASCADE;'

# Restart API to clear cache
docker restart gdpr-api-dev
```

### Increase Queue Processing Speed

```bash
# Add to .env.devprod
echo "MAX_CONCURRENT_SCANS=3" >> .env.devprod

# Recreate container
docker stop gdpr-api-dev && docker rm gdpr-api-dev
docker run -d --name gdpr-api-dev ... --env-file .env.devprod ...
```

---

## Azure DevOps Pipelines

### Single Load Test

**File**: `azure-pipelines-loadtest.yml`

**Parameters**:
- `scenario`: smoke, load
- `environment`: dev, prod
- `queueType`: postgres, redis
- `vus`: Custom VU count
- `duration`: Custom duration

### Queue Comparison Pipeline

**File**: `azure-pipelines-loadtest-compare.yml`

**Workflow**:
1. Setup: Install k6, verify health
2. Test PostgreSQL queue
3. Test Redis queue
4. Restore PostgreSQL (default)
5. Generate comparison report

**Artifacts**:
- `postgres-results/` - PostgreSQL k6 JSON
- `redis-results/` - Redis k6 JSON
- `comparison-report/` - Markdown report

---

## Key Recommendations

1. **Use async endpoint** (`/api/scanner/queue`) for all production traffic
2. **Use Redis/BullMQ** for queue management
3. **Safe capacity**: Up to 36 req/s with Redis
4. **Scaling options**:
   - Increase `MAX_CONCURRENT_SCANS` (adds ~300-600MB RAM)
   - Horizontal scaling (multiple API instances)

---

## References

- [k6 Documentation](https://k6.io/docs/)
- [k6 Thresholds](https://k6.io/docs/using-k6/thresholds/)
- [Load Testing Best Practices](https://k6.io/docs/testing-guides/load-testing-websites/)
- [Grafana Cloud k6](https://grafana.com/products/cloud/k6/)

---

## Related Documents

- [Load Testing Guide](../LOAD-TESTING-GUIDE.md) - Detailed technical guide
- [Load Test Results Template](../LOAD-TEST-RESULTS-TEMPLATE.md) - Template for documenting results
