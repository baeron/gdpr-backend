// Breakpoint test - find maximum stable capacity
// Gradually increases load until errors appear
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Max VUs for Grafana Cloud free tier (100 VUs limit)
const MAX_VUS = __ENV.MAX_VUS ? parseInt(__ENV.MAX_VUS) : 50;

export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: Math.min(25, MAX_VUS),
      maxVUs: MAX_VUS,
      stages: [
        { duration: '1m', target: 5 },    // 5 req/s
        { duration: '1m', target: 10 },   // 10 req/s
        { duration: '1m', target: 20 },   // 20 req/s
        { duration: '1m', target: 30 },   // 30 req/s
        { duration: '1m', target: 40 },   // 40 req/s
        { duration: '1m', target: 50 },   // 50 req/s (max)
        { duration: '1m', target: 0 },    // Ramp down
      ],
    },
  },
  thresholds: {
    // Stop test if error rate exceeds 10%
    errors: ['rate<0.10'],
    http_req_duration: ['p(95)<5000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const TEST_WEBSITES = [
  'https://example.com',
  'https://httpbin.org',
];

export default function () {
  const start = Date.now();
  
  // Submit scan (async queue - returns immediately)
  const website = TEST_WEBSITES[Math.floor(Math.random() * TEST_WEBSITES.length)];
  
  const res = http.post(
    `${BASE_URL}/api/scanner/queue`,
    JSON.stringify({ websiteUrl: website }),
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: '10s',
    }
  );
  
  const success = check(res, {
    'scan queued': (r) => r.status === 200 || r.status === 201,
    'has job id': (r) => {
      try {
        return JSON.parse(r.body).id !== undefined;
      } catch { return false; }
    },
  });
  
  errorRate.add(!success);
  responseTime.add(Date.now() - start);
  
  // No sleep - test pure throughput
}

export function setup() {
  console.log('=== Breakpoint Test ===');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Max VUs: ${MAX_VUS} (set MAX_VUS env to override)`);
  console.log('');
  console.log('Load stages:');
  console.log('  1m: 5 req/s');
  console.log('  2m: 10 req/s');
  console.log('  3m: 20 req/s');
  console.log('  4m: 30 req/s');
  console.log('  5m: 40 req/s');
  console.log('  6m: 50 req/s');
  console.log('');
  console.log('Watch for: when error rate starts climbing');
  console.log('');
  
  const res = http.get(`${BASE_URL}/api/health`);
  if (res.status !== 200) {
    throw new Error('Target not healthy');
  }
  
  return { startTime: Date.now() };
}

export function teardown(data) {
  console.log('');
  console.log('=== Test Complete ===');
  console.log(`Duration: ${Math.round((Date.now() - data.startTime) / 1000)}s`);
  console.log('');
  console.log('Find the point where errors started to identify max capacity.');
}
