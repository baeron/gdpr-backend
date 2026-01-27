// Soak/Endurance test - long-running test to find memory leaks and degradation
// Use case: Detect memory leaks, connection pool exhaustion, gradual degradation
// Recommended: Run for 1-4 hours in pre-production
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics for tracking degradation over time
const requestCount = new Counter('total_requests');
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time_trend');
const healthCheckTime = new Trend('health_check_time');

// Duration parameter - override with -e DURATION=4h
const DURATION = __ENV.DURATION || '1h';
const VUS = parseInt(__ENV.VUS) || 30;

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    // Strict thresholds for long-running tests
    http_req_failed: ['rate<0.02'],              // Error rate < 2%
    http_req_duration: ['p(95)<5000'],           // 95% < 5s
    health_check_time: ['p(99)<1000'],           // Health should stay fast
    error_rate: ['rate<0.05'],                   // Overall error rate
    
    // Degradation detection: compare start vs end
    // If p99 grows significantly, there might be a memory leak
    'response_time_trend': ['p(99)<8000'],       // p99 should not exceed 8s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const TEST_WEBSITES = [
  'https://example.com',
  'https://httpbin.org',
  'https://jsonplaceholder.typicode.com',
];

// Track metrics over time periods (every 10 minutes)
let periodMetrics = {
  period: 0,
  requests: 0,
  errors: 0,
  totalResponseTime: 0,
};

export default function () {
  const iterStart = Date.now();
  let hasError = false;

  // 1. Health check (monitor for degradation)
  const healthStart = Date.now();
  const healthRes = http.get(`${BASE_URL}/api/health`, {
    tags: { name: 'health' },
    timeout: '10s',
  });
  healthCheckTime.add(Date.now() - healthStart);
  
  const healthOk = check(healthRes, {
    'health OK': (r) => r.status === 200,
  });
  
  if (!healthOk) hasError = true;

  // 2. Queue stats (monitor queue health)
  const statsRes = http.get(`${BASE_URL}/api/health/queue/stats`, {
    tags: { name: 'queue_stats' },
    timeout: '10s',
  });
  
  check(statsRes, {
    'queue stats OK': (r) => r.status === 200,
  });

  // 3. Submit scan
  const website = TEST_WEBSITES[Math.floor(Math.random() * TEST_WEBSITES.length)];
  
  const scanRes = http.post(
    `${BASE_URL}/api/scanner/scan`,
    JSON.stringify({ websiteUrl: website }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'scan' },
      timeout: '30s',
    }
  );
  
  const scanOk = check(scanRes, {
    'scan submitted': (r) => r.status === 200 || r.status === 201,
  });
  
  if (!scanOk) hasError = true;

  // Track metrics
  const iterDuration = Date.now() - iterStart;
  responseTime.add(iterDuration);
  requestCount.add(1);
  errorRate.add(hasError ? 1 : 0);

  // Log progress every ~10 minutes (based on iteration count)
  periodMetrics.requests++;
  periodMetrics.errors += hasError ? 1 : 0;
  periodMetrics.totalResponseTime += iterDuration;

  // Realistic user behavior - variable think time
  sleep(Math.random() * 3 + 1); // 1-4s between requests
}

export function setup() {
  console.log('=== Soak/Endurance Test ===');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Virtual Users: ${VUS}`);
  console.log(`Duration: ${DURATION}`);
  console.log('');
  console.log('Purpose: Detect memory leaks, connection exhaustion, degradation');
  console.log('Watch for: Increasing response times, growing error rates');
  console.log('');
  
  // Pre-flight check
  const res = http.get(`${BASE_URL}/api/health`);
  if (res.status !== 200) {
    throw new Error(`Target is not healthy: ${res.status}`);
  }
  
  // Get initial memory/stats if available
  const statsRes = http.get(`${BASE_URL}/api/health/queue/stats`);
  if (statsRes.status === 200) {
    console.log('Initial queue stats:', statsRes.body);
  }
  
  console.log('✓ Target is healthy, starting soak test...');
  console.log('');
  
  return { 
    startTime: Date.now(),
    initialHealthResponseTime: res.timings.duration,
  };
}

export function teardown(data) {
  const durationMinutes = Math.round((Date.now() - data.startTime) / 60000);
  
  console.log('');
  console.log('=== Soak Test Complete ===');
  console.log(`Total duration: ${durationMinutes} minutes`);
  console.log(`Initial health response: ${data.initialHealthResponseTime}ms`);
  console.log('');
  
  // Final health check
  const finalHealth = http.get(`${BASE_URL}/api/health`);
  console.log(`Final health response: ${finalHealth.timings.duration}ms`);
  console.log(`Health status: ${finalHealth.status === 200 ? 'OK' : 'DEGRADED'}`);
  
  // Check for degradation
  const degradation = finalHealth.timings.duration / data.initialHealthResponseTime;
  if (degradation > 2) {
    console.log(`⚠️ WARNING: Response time degraded ${degradation.toFixed(1)}x - possible memory leak!`);
  } else {
    console.log('✓ No significant degradation detected');
  }
  
  // Final queue stats
  const statsRes = http.get(`${BASE_URL}/api/health/queue/stats`);
  if (statsRes.status === 200) {
    console.log('Final queue stats:', statsRes.body);
  }
}
