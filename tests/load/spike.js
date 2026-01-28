// Spike test - simulates sudden traffic bursts
// Use case: Marketing campaign launch, viral post, DDoS-like patterns
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const spikeRequests = new Counter('spike_requests');
const spikeErrors = new Rate('spike_errors');
const responseTime = new Trend('response_time');

// Max VUs for Grafana Cloud free tier (100 VUs limit)
const MAX_VUS = __ENV.MAX_VUS ? parseInt(__ENV.MAX_VUS) : 100;
const SPIKE_1 = Math.min(80, MAX_VUS);   // First spike
const SPIKE_2 = Math.min(100, MAX_VUS);  // Second spike (max)

export const options = {
  scenarios: {
    // Sudden spike pattern
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 },       // Warm up
        { duration: '1m', target: 10 },        // Normal load
        { duration: '10s', target: SPIKE_1 },  // SPIKE! Sudden jump to 80 users
        { duration: '3m', target: SPIKE_1 },   // Stay at spike
        { duration: '10s', target: 10 },       // Drop back
        { duration: '1m', target: 10 },        // Recovery period
        { duration: '10s', target: SPIKE_2 },  // Second SPIKE! To max (100)
        { duration: '3m', target: SPIKE_2 },   // Stay at higher spike
        { duration: '10s', target: 0 },        // Ramp down
      ],
    },
  },
  thresholds: {
    // During spikes, we expect some degradation but should not crash
    http_req_failed: ['rate<0.15'],           // Error rate < 15% during spikes
    http_req_duration: ['p(95)<10000'],       // 95% < 10s (relaxed for spikes)
    'http_req_duration{name:health}': ['p(95)<2000'],  // Health should stay fast
    spike_errors: ['rate<0.2'],               // Custom error tracking
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
  const startTime = Date.now();
  
  // 1. Health check (should always be fast)
  const healthRes = http.get(`${BASE_URL}/api/health`, {
    tags: { name: 'health' },
    timeout: '5s',
  });
  
  const healthOk = check(healthRes, {
    'health check OK': (r) => r.status === 200,
  });
  
  if (!healthOk) {
    spikeErrors.add(1);
  }

  // 2. Submit scan request (async queue - returns immediately)
  const website = TEST_WEBSITES[Math.floor(Math.random() * TEST_WEBSITES.length)];
  
  const scanRes = http.post(
    `${BASE_URL}/api/scanner/queue`,
    JSON.stringify({ websiteUrl: website }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'scan' },
      timeout: '10s',
    }
  );
  
  const scanOk = check(scanRes, {
    'scan queued': (r) => r.status === 200 || r.status === 201,
    'has job id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (!scanOk) {
    spikeErrors.add(1);
  } else {
    spikeErrors.add(0);
  }

  spikeRequests.add(1);
  responseTime.add(Date.now() - startTime);

  // Short sleep to simulate real user behavior
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5s random delay
}

export function setup() {
  console.log('=== Spike Test ===');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Pattern: Normal → ${SPIKE_1} VUs spike → Recovery → ${SPIKE_2} VUs spike → End`);
  console.log('Duration: ~9 minutes');
  console.log(`Max VUs: ${MAX_VUS} (set MAX_VUS env to override)`);
  console.log('');
  
  // Verify target is healthy
  const res = http.get(`${BASE_URL}/api/health`);
  if (res.status !== 200) {
    throw new Error(`Target is not healthy: ${res.status}`);
  }
  console.log('✓ Target is healthy');
  
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = Math.round((Date.now() - data.startTime) / 1000);
  console.log('');
  console.log('=== Spike Test Complete ===');
  console.log(`Total duration: ${duration}s`);
}
