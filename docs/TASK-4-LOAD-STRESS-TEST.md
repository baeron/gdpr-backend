# Task #4: Load Stress Test - PostgreSQL vs Redis/BullMQ

## Overview

Conduct load testing to determine the performance characteristics of PostgreSQL queue vs Redis/BullMQ queue implementations on a constrained environment (1 core / 1GB RAM). The goal is to identify the maximum concurrent scans each solution can handle and provide recommendations.

## Task Requirements

### Acceptance Criteria
- [ ] Tests conducted with 100, 500, 1000 concurrent requests
- [ ] Response time measured for each solution
- [ ] Performance degradation threshold identified
- [ ] Results presented in a comparison table

### Definition of Done
- [ ] PostgreSQL solution tests completed
- [ ] Redis/BullMQ solution tests completed
- [ ] Report with results and recommendations created
- [ ] Maximum concurrent analytics determined

### Subtasks
| ID | Title | Status |
|----|-------|--------|
| #37 | Setup test environment for load testing | To Do |
| #38 | Select and configure load testing tool | To Do |
| #39 | Run load tests for PostgreSQL solution | To Do |
| #40 | Run load tests for Redis/BullMQ solution | To Do |
| #41 | Create report with results and recommendations | To Do |
| #133 | Add endpoint /api/health/queue/stats for queue metrics | To Do |

---

## Current Architecture

### PostgreSQL Queue (Default)
- Uses database polling with `ScanJob` table
- Implemented in `postgres-queue.service.ts`
- No additional infrastructure required
- Suitable for low-to-medium traffic

### Redis/BullMQ Queue (Optional)
- Uses Redis with BullMQ library
- Implemented in `redis-queue.service.ts`
- Requires Redis server (additional ~50MB RAM)
- Better for high-throughput scenarios

### Server Constraints
- **CPU**: 1 core
- **RAM**: 1 GB
- **Location**: Vultr VPS

---

## Implementation Plan

### Step 1: Setup Test Environment (#37)

#### 1.1 Create Isolated Test Database
```bash
# On server
docker exec -it gdpr-postgres psql -U gdpr -d gdpr_audit -c "
  CREATE DATABASE gdpr_audit_test WITH TEMPLATE gdpr_audit;
"
```

#### 1.2 Configure Test Environment Variables
```bash
# .env.test
DATABASE_URL="postgresql://gdpr:password@localhost:5432/gdpr_audit_test"
NODE_ENV=test
QUEUE_TYPE=postgres  # or redis
```

#### 1.3 Setup Monitoring
```bash
# Install monitoring tools on server
apt-get install -y htop iotop

# Docker stats for container monitoring
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

---

### Step 2: Select and Configure Load Testing Tool (#38)

#### Recommended: k6 (Grafana)

**Why k6?**
- Modern, developer-friendly
- JavaScript-based test scripts
- Built-in metrics and thresholds
- Low resource footprint
- Great for CI/CD integration

#### 2.1 Install k6

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

#### 2.2 Alternative: Artillery

```bash
npm install -g artillery
```

---

### Step 3: Create Test Scripts

#### 3.1 k6 Test Script: `tests/load/scan-queue.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const scanRequests = new Counter('scan_requests');
const scanDuration = new Trend('scan_duration');

// Test configuration
export const options = {
  scenarios: {
    // Smoke test - verify system works
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      startTime: '0s',
      tags: { test_type: 'smoke' },
    },
    // Load test - normal load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },   // Ramp up to 50 users
        { duration: '3m', target: 50 },   // Stay at 50 users
        { duration: '1m', target: 100 },  // Ramp up to 100 users
        { duration: '3m', target: 100 },  // Stay at 100 users
        { duration: '1m', target: 0 },    // Ramp down
      ],
      startTime: '30s',
      tags: { test_type: 'load' },
    },
    // Stress test - find breaking point
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },  // Ramp up
        { duration: '5m', target: 100 },  // Stay
        { duration: '2m', target: 200 },  // Push higher
        { duration: '5m', target: 200 },  // Stay
        { duration: '2m', target: 500 },  // Stress
        { duration: '5m', target: 500 },  // Stay at stress
        { duration: '2m', target: 0 },    // Ramp down
      ],
      startTime: '10m',
      tags: { test_type: 'stress' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% of requests < 2s
    http_req_failed: ['rate<0.1'],       // Error rate < 10%
    scan_duration: ['p(95)<5000'],       // 95% of scans < 5s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test websites for scanning
const TEST_WEBSITES = [
  'https://example.com',
  'https://httpbin.org',
  'https://jsonplaceholder.typicode.com',
];

export default function () {
  const website = TEST_WEBSITES[Math.floor(Math.random() * TEST_WEBSITES.length)];
  
  // 1. Submit scan request
  const submitRes = http.post(
    `${BASE_URL}/api/scanner/scan`,
    JSON.stringify({ websiteUrl: website }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'submit_scan' },
    }
  );

  check(submitRes, {
    'scan submitted': (r) => r.status === 201 || r.status === 200,
    'has job id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.jobId !== undefined;
      } catch {
        return false;
      }
    },
  });

  scanRequests.add(1);

  if (submitRes.status === 201 || submitRes.status === 200) {
    const jobId = JSON.parse(submitRes.body).jobId;
    
    // 2. Poll for job status
    let attempts = 0;
    const maxAttempts = 30;
    const startTime = Date.now();
    
    while (attempts < maxAttempts) {
      const statusRes = http.get(
        `${BASE_URL}/api/scanner/status/${jobId}`,
        { tags: { name: 'check_status' } }
      );
      
      if (statusRes.status === 200) {
        const status = JSON.parse(statusRes.body);
        
        if (status.status === 'completed' || status.status === 'failed') {
          scanDuration.add(Date.now() - startTime);
          break;
        }
      }
      
      attempts++;
      sleep(1);
    }
  }

  sleep(1);
}

// Lifecycle hooks
export function setup() {
  console.log(`Testing against: ${BASE_URL}`);
  
  // Health check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  if (healthRes.status !== 200) {
    throw new Error('API is not healthy');
  }
  
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Test completed in ${duration}s`);
}
```

#### 3.2 Queue Stats Endpoint Test: `tests/load/queue-stats.js`

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<100'],  // Stats endpoint should be fast
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const res = http.get(`${BASE_URL}/api/health/queue/stats`);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has queue stats': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.pending !== undefined && body.processing !== undefined;
      } catch {
        return false;
      }
    },
  });
}
```

---

### Step 4: Add Queue Stats Endpoint (#133)

#### 4.1 Update Health Controller

```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import { QUEUE_SERVICE, IQueueService } from '../scanner/queue/queue.interface';

@ApiTags('Health')
@Controller('api/health')
export class HealthController {
  constructor(
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('queue/stats')
  @ApiOperation({ summary: 'Queue statistics' })
  async queueStats() {
    const stats = await this.queueService.getStats();
    return {
      ...stats,
      timestamp: new Date().toISOString(),
      queueType: process.env.QUEUE_TYPE || 'postgres',
    };
  }
}
```

---

### Step 5: Run PostgreSQL Tests (#39)

#### 5.1 Prepare Environment
```bash
# Ensure PostgreSQL queue is active
export QUEUE_TYPE=postgres

# Restart API with PostgreSQL queue
docker-compose --env-file .env.production --profile postgres up -d
```

#### 5.2 Run Tests
```bash
# Smoke test first
k6 run --env BASE_URL=https://api.policytracker.eu tests/load/scan-queue.js --tag testrun=postgres-smoke -o json=results/postgres-smoke.json

# Full load test
k6 run --env BASE_URL=https://api.policytracker.eu tests/load/scan-queue.js -o json=results/postgres-load.json

# Monitor during test
watch -n 1 'docker stats --no-stream'
```

#### 5.3 Collect Metrics
- Response times (p50, p95, p99)
- Error rate
- Throughput (requests/second)
- CPU usage
- Memory usage
- Queue depth over time

---

### Step 6: Run Redis/BullMQ Tests (#40)

#### 6.1 Prepare Environment
```bash
# Switch to Redis queue
export QUEUE_TYPE=redis

# Start with Redis profile
docker-compose --env-file .env.production --profile redis up -d
```

#### 6.2 Run Tests
```bash
# Smoke test
k6 run --env BASE_URL=https://api.policytracker.eu tests/load/scan-queue.js --tag testrun=redis-smoke -o json=results/redis-smoke.json

# Full load test
k6 run --env BASE_URL=https://api.policytracker.eu tests/load/scan-queue.js -o json=results/redis-load.json
```

---

### Step 7: Create Report (#41)

#### 7.1 Results Template

```markdown
# Load Test Results: PostgreSQL vs Redis/BullMQ

## Test Environment
- **Server**: Vultr VPS (1 core, 1GB RAM)
- **Date**: YYYY-MM-DD
- **API Version**: X.X.X
- **Test Tool**: k6 v0.XX

## Summary

| Metric | PostgreSQL | Redis/BullMQ | Winner |
|--------|------------|--------------|--------|
| Max Concurrent Users | XX | XX | ? |
| Avg Response Time | XXms | XXms | ? |
| p95 Response Time | XXms | XXms | ? |
| Error Rate | X% | X% | ? |
| Memory Usage | XXX MB | XXX MB | ? |
| CPU Usage | XX% | XX% | ? |

## Detailed Results

### PostgreSQL Queue

#### Load Profile: 100 Concurrent Users
| Metric | Value |
|--------|-------|
| Requests/sec | XX |
| Avg Response | XXms |
| p95 Response | XXms |
| Error Rate | X% |

#### Load Profile: 500 Concurrent Users
...

### Redis/BullMQ Queue
...

## Resource Utilization

### PostgreSQL
- Peak CPU: XX%
- Peak Memory: XXX MB
- Database connections: XX

### Redis/BullMQ
- Peak CPU: XX%
- Peak Memory: XXX MB (API) + XXX MB (Redis)
- Redis memory: XXX MB

## Recommendations

1. **For low traffic (< 50 concurrent scans)**: Use PostgreSQL queue
   - Simpler architecture
   - No additional infrastructure
   - Sufficient performance

2. **For medium traffic (50-200 concurrent scans)**: Consider Redis/BullMQ
   - Better throughput
   - Lower latency
   - Requires additional ~50MB RAM

3. **For high traffic (> 200 concurrent scans)**: Upgrade server or scale horizontally

## Breaking Points

- **PostgreSQL**: Degradation starts at XX concurrent users
- **Redis/BullMQ**: Degradation starts at XX concurrent users

## Conclusion

Based on the test results, the recommended solution for 1 core / 1GB RAM is: **[PostgreSQL/Redis]**
```

---

## Test Execution Commands

### Quick Reference

```bash
# Install k6
brew install k6  # macOS
# or
sudo apt-get install k6  # Linux

# Create results directory
mkdir -p tests/load/results

# Run smoke test (quick verification)
k6 run --vus 5 --duration 30s tests/load/scan-queue.js

# Run load test (100 users)
k6 run --vus 100 --duration 5m tests/load/scan-queue.js

# Run stress test (find limits)
k6 run tests/load/scan-queue.js

# Run with HTML report
k6 run tests/load/scan-queue.js --out json=results/test.json
# Then convert to HTML using k6-reporter

# Run against specific environment
k6 run --env BASE_URL=https://api.policytracker.eu tests/load/scan-queue.js
k6 run --env BASE_URL=https://dev.api.policytracker.eu tests/load/scan-queue.js
```

---

## Monitoring Commands

```bash
# Server monitoring
ssh deploy@45.63.119.28

# Real-time container stats
docker stats

# CPU and memory
htop

# Disk I/O
iotop

# PostgreSQL connections
docker exec gdpr-postgres psql -U gdpr -d gdpr_audit -c "SELECT count(*) FROM pg_stat_activity;"

# Redis stats (if using Redis)
docker exec gdpr-redis redis-cli INFO stats
docker exec gdpr-redis redis-cli INFO memory

# Queue depth
curl -s https://api.policytracker.eu/api/health/queue/stats | jq
```

---

## Files to Create

| File | Description |
|------|-------------|
| `tests/load/scan-queue.js` | Main k6 load test script |
| `tests/load/queue-stats.js` | Queue stats endpoint test |
| `tests/load/config.js` | Shared configuration |
| `tests/load/results/` | Directory for test results |
| `docs/LOAD-TEST-RESULTS.md` | Final report |

---

## Verification Checklist

After implementation, verify:

- [ ] k6 installed and working
- [ ] Test scripts created
- [ ] Queue stats endpoint added
- [ ] PostgreSQL tests completed
- [ ] Redis/BullMQ tests completed
- [ ] Results documented
- [ ] Recommendations provided

---

## Troubleshooting

### k6 Connection Refused
```bash
# Check if API is running
curl -v https://api.policytracker.eu/api/health

# Check firewall
sudo ufw status
```

### High Error Rate
```bash
# Check API logs
docker logs gdpr-api --tail 100

# Check database connections
docker exec gdpr-postgres psql -U gdpr -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

### Memory Issues
```bash
# Check container memory limits
docker inspect gdpr-api | jq '.[0].HostConfig.Memory'

# Increase if needed in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 512M
```

---

## Story Points: 8

**Estimated time:** 6-8 hours

**Complexity:** Medium-High
- Environment setup
- Test script development
- Running multiple test scenarios
- Data collection and analysis
- Report generation
