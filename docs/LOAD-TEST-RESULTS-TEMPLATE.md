# Load Test Results: PostgreSQL vs Redis/BullMQ

## Test Environment

| Parameter | Value |
|-----------|-------|
| **Server** | Vultr VPS (1 core, 1GB RAM) |
| **Date** | YYYY-MM-DD |
| **API Version** | X.X.X |
| **Test Tool** | k6 vX.XX |
| **Node.js** | v20.x |

---

## Executive Summary

> **Recommendation**: [PostgreSQL / Redis] is recommended for the current server configuration.

| Metric | PostgreSQL | Redis/BullMQ | Winner |
|--------|------------|--------------|--------|
| Max Concurrent Users | XX | XX | ? |
| Avg Response Time | XXms | XXms | ? |
| p95 Response Time | XXms | XXms | ? |
| Error Rate | X% | X% | ? |
| Memory Usage (API) | XXX MB | XXX MB | ? |
| Total Memory | XXX MB | XXX MB | ? |

---

## Detailed Results

### Test Scenarios Executed

| Scenario | VUs | Duration | Description |
|----------|-----|----------|-------------|
| Smoke | 5 | 30s | Basic functionality verification |
| Load | 50-100 | 9m | Normal load simulation |
| Stress | 100-500 | 23m | Find breaking point |

---

### PostgreSQL Queue Results

#### Smoke Test (5 VUs, 30s)

| Metric | Value |
|--------|-------|
| Total Requests | XX |
| Requests/sec | XX |
| Avg Response Time | XXms |
| p95 Response Time | XXms |
| Error Rate | X% |

#### Load Test (50-100 VUs, 9m)

| Metric | 50 VUs | 100 VUs |
|--------|--------|---------|
| Requests/sec | XX | XX |
| Avg Response Time | XXms | XXms |
| p95 Response Time | XXms | XXms |
| Error Rate | X% | X% |

#### Stress Test (100-500 VUs, 23m)

| VUs | Requests/sec | p95 Response | Error Rate | Notes |
|-----|--------------|--------------|------------|-------|
| 100 | XX | XXms | X% | Stable |
| 200 | XX | XXms | X% | |
| 500 | XX | XXms | X% | Degradation? |

#### Resource Usage (PostgreSQL)

| Metric | Idle | 50 VUs | 100 VUs | 500 VUs |
|--------|------|--------|---------|---------|
| API CPU | X% | X% | X% | X% |
| API Memory | XX MB | XX MB | XX MB | XX MB |
| DB Connections | X | X | X | X |
| DB CPU | X% | X% | X% | X% |

---

### Redis/BullMQ Queue Results

#### Smoke Test (5 VUs, 30s)

| Metric | Value |
|--------|-------|
| Total Requests | XX |
| Requests/sec | XX |
| Avg Response Time | XXms |
| p95 Response Time | XXms |
| Error Rate | X% |

#### Load Test (50-100 VUs, 9m)

| Metric | 50 VUs | 100 VUs |
|--------|--------|---------|
| Requests/sec | XX | XX |
| Avg Response Time | XXms | XXms |
| p95 Response Time | XXms | XXms |
| Error Rate | X% | X% |

#### Stress Test (100-500 VUs, 23m)

| VUs | Requests/sec | p95 Response | Error Rate | Notes |
|-----|--------------|--------------|------------|-------|
| 100 | XX | XXms | X% | Stable |
| 200 | XX | XXms | X% | |
| 500 | XX | XXms | X% | Degradation? |

#### Resource Usage (Redis)

| Metric | Idle | 50 VUs | 100 VUs | 500 VUs |
|--------|------|--------|---------|---------|
| API CPU | X% | X% | X% | X% |
| API Memory | XX MB | XX MB | XX MB | XX MB |
| Redis CPU | X% | X% | X% | X% |
| Redis Memory | XX MB | XX MB | XX MB | XX MB |
| Total Memory | XX MB | XX MB | XX MB | XX MB |

---

## Comparison Charts

### Response Time Comparison

```
PostgreSQL p95 Response Time (ms)
50 VUs:  ████████████████ XXXms
100 VUs: ████████████████████████ XXXms
500 VUs: ████████████████████████████████ XXXms

Redis/BullMQ p95 Response Time (ms)
50 VUs:  ████████████████ XXXms
100 VUs: ████████████████████████ XXXms
500 VUs: ████████████████████████████████ XXXms
```

### Throughput Comparison

```
PostgreSQL Requests/sec
50 VUs:  ████████████████ XX req/s
100 VUs: ████████████████████ XX req/s
500 VUs: ████████████████ XX req/s

Redis/BullMQ Requests/sec
50 VUs:  ████████████████ XX req/s
100 VUs: ████████████████████ XX req/s
500 VUs: ████████████████████████ XX req/s
```

---

## Breaking Points

### PostgreSQL
- **Stable until**: XX concurrent users
- **Degradation starts at**: XX concurrent users
- **Failure point**: XX concurrent users
- **Primary bottleneck**: [CPU / Memory / DB Connections / Polling interval]

### Redis/BullMQ
- **Stable until**: XX concurrent users
- **Degradation starts at**: XX concurrent users  
- **Failure point**: XX concurrent users
- **Primary bottleneck**: [CPU / Memory / Redis connections]

---

## Memory Analysis

### 1 GB RAM Budget

| Component | PostgreSQL Setup | Redis Setup |
|-----------|------------------|-------------|
| OS + Base | ~200 MB | ~200 MB |
| PostgreSQL | ~100 MB | ~100 MB |
| Redis | - | ~50 MB |
| API (idle) | ~150 MB | ~150 MB |
| API (peak) | ~XXX MB | ~XXX MB |
| **Available** | ~XXX MB | ~XXX MB |

---

## Recommendations

### For Low Traffic (< 50 concurrent scans)

**Recommendation**: PostgreSQL Queue

- Simpler architecture
- No additional infrastructure
- Sufficient performance
- Lower memory footprint

### For Medium Traffic (50-200 concurrent scans)

**Recommendation**: [PostgreSQL / Redis] - based on test results

- [Rationale based on actual test data]

### For High Traffic (> 200 concurrent scans)

**Recommendation**: Upgrade server or horizontal scaling

- Current 1 core / 1GB is insufficient
- Consider 2 core / 2GB minimum
- Or implement queue-based horizontal scaling

---

## Action Items

- [ ] Set QUEUE_TYPE based on recommendation
- [ ] Configure memory limits in docker-compose
- [ ] Set up monitoring/alerting for queue depth
- [ ] Document operational procedures

---

## Appendix

### Test Commands Used

```bash
# Smoke test
k6 run --env BASE_URL=https://api.policytracker.eu tests/load/smoke.js

# Load test - PostgreSQL
QUEUE_TYPE=postgres
k6 run --env BASE_URL=https://api.policytracker.eu tests/load/scan-queue.js

# Load test - Redis
QUEUE_TYPE=redis
k6 run --env BASE_URL=https://api.policytracker.eu tests/load/scan-queue.js
```

### Monitoring Commands

```bash
# Container stats
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Queue depth
curl -s https://api.policytracker.eu/api/health/queue/stats | jq

# PostgreSQL connections
docker exec gdpr-postgres psql -U gdpr -d gdpr_audit -c "SELECT count(*) FROM pg_stat_activity;"

# Redis stats
docker exec gdpr-redis redis-cli INFO stats
```

### Raw Data Files

- `postgres-smoke-YYYYMMDD.json`
- `postgres-load-YYYYMMDD.json`
- `postgres-stress-YYYYMMDD.json`
- `redis-smoke-YYYYMMDD.json`
- `redis-load-YYYYMMDD.json`
- `redis-stress-YYYYMMDD.json`

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Tester | | |
| Reviewer | | |
| Approved | | |
