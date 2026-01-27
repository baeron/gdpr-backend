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
  
  // 1. Submit scan request (async queue - returns immediately)
  const submitRes = http.post(
    `${BASE_URL}/api/scanner/queue`,
    JSON.stringify({ websiteUrl: website }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'submit_scan' },
    }
  );

  check(submitRes, {
    'scan queued': (r) => r.status === 201 || r.status === 200,
    'has job id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id !== undefined;
      } catch {
        return false;
      }
    },
  });

  scanRequests.add(1);

  if (submitRes.status === 201 || submitRes.status === 200) {
    const jobId = JSON.parse(submitRes.body).id;
    
    // 2. Poll for job status
    let attempts = 0;
    const maxAttempts = 60; // Allow up to 60 seconds for scan
    const startTime = Date.now();
    
    while (attempts < maxAttempts) {
      const statusRes = http.get(
        `${BASE_URL}/api/scanner/job/${jobId}`,
        { tags: { name: 'check_status' } }
      );
      
      if (statusRes.status === 200) {
        const status = JSON.parse(statusRes.body);
        
        if (status.status === 'COMPLETED' || status.status === 'FAILED') {
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
