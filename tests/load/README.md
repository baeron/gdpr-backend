# Load Testing with k6

This directory contains k6 load test scripts for comparing PostgreSQL queue vs Redis/BullMQ queue performance.

## Azure DevOps Pipelines

### 1. Load Test Pipeline (Single Queue)

For testing a specific queue type:

1. Go to Pipelines → **Load Test**
2. Select: scenario, environment, queue type
3. Results saved as artifacts

See `azure-pipelines-loadtest.yml`

---

### 2. Comparison Pipeline (PostgreSQL vs Redis)

**Automated comparison** that runs both queue types and generates report:

1. Go to Pipelines → **Load Test Compare**
2. Select: scenario, environment
3. Pipeline will:
   - Run PostgreSQL tests
   - Switch server to Redis
   - Run Redis tests
   - Restore PostgreSQL (default)
   - Generate `COMPARISON-REPORT.md`

See `azure-pipelines-loadtest-compare.yml`

**Output artifacts:**
- `postgres-results/` — PostgreSQL k6 JSON
- `redis-results/` — Redis k6 JSON
- `comparison-report/` — Markdown comparison report

---

## Local Execution

### Install k6

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## Test Scripts

| Script | Description |
|--------|-------------|
| `smoke.js` | Quick verification (5 VUs, 30s) |
| `queue-stats.js` | Test queue stats endpoint |
| `scan-queue.js` | Full load/stress test with scenarios |
| `config.js` | Shared configuration |

## Quick Start

```bash
# Smoke test (local)
k6 run tests/load/smoke.js

# Smoke test (production)
k6 run --env BASE_URL=https://api.policytracker.eu tests/load/smoke.js

# Queue stats test
k6 run --env BASE_URL=https://api.policytracker.eu tests/load/queue-stats.js

# Full load test
k6 run --env BASE_URL=https://api.policytracker.eu tests/load/scan-queue.js
```

## Test Scenarios

### Smoke Test (smoke.js)
- 5 virtual users
- 30 seconds duration
- Verifies basic functionality

### Queue Stats Test (queue-stats.js)
- 10 virtual users
- 1 minute duration
- Tests `/api/health/queue/stats` endpoint

### Full Test (scan-queue.js)
Contains three scenarios that run sequentially:

1. **Smoke** (0s-30s): 1 VU, basic verification
2. **Load** (30s-10m): Ramps from 0 to 100 VUs
3. **Stress** (10m-33m): Ramps up to 500 VUs

## Running Tests

### Against Local Environment
```bash
# Start API with PostgreSQL queue
export QUEUE_TYPE=postgres
npm run start:dev

# Run test
k6 run tests/load/smoke.js
```

### Against Production
```bash
# PostgreSQL queue (default)
k6 run --env BASE_URL=https://api.policytracker.eu tests/load/scan-queue.js

# Save results to JSON
k6 run --env BASE_URL=https://api.policytracker.eu -o json=tests/load/results/postgres-$(date +%Y%m%d).json tests/load/scan-queue.js
```

### Custom VUs and Duration
```bash
# Quick test with 10 users for 2 minutes
k6 run --vus 10 --duration 2m tests/load/smoke.js

# Heavy load test
k6 run --vus 100 --duration 5m tests/load/smoke.js
```

## Monitoring During Tests

### Server-side
```bash
# SSH to server
ssh deploy@45.63.119.28

# Container stats
docker stats

# Queue depth
curl -s https://api.policytracker.eu/api/health/queue/stats | jq

# PostgreSQL connections
docker exec gdpr-postgres psql -U gdpr -d gdpr_audit -c "SELECT count(*) FROM pg_stat_activity;"

# Redis stats (if using Redis)
docker exec gdpr-redis redis-cli INFO stats
```

## Results

Results are saved in `tests/load/results/`:
- `postgres-YYYYMMDD.json` - PostgreSQL queue results
- `redis-YYYYMMDD.json` - Redis queue results

## Thresholds

| Metric | Smoke | Load | Stress |
|--------|-------|------|--------|
| p95 Response Time | <1s | <2s | <5s |
| Error Rate | <1% | <5% | <10% |

## Troubleshooting

### Connection Refused
```bash
# Check if API is running
curl -v https://api.policytracker.eu/api/health
```

### High Error Rate
```bash
# Check API logs
docker logs gdpr-api --tail 100
```

### Timeout Errors
- Reduce VU count
- Check server resources: `htop`
- Check database connections
