// Smoke test - quick verification that the system works
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],  // Error rate < 1%
    // Health endpoints should be fast
    'http_req_duration{name:health}': ['p(95)<500'],
    'http_req_duration{name:queue_stats}': ['p(95)<500'],
    // Scan submission can be slower (queues the job)
    'http_req_duration{name:scan}': ['p(95)<15000'],  // 15s for actual scan
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 1. Health check
  const healthRes = http.get(`${BASE_URL}/api/health`, {
    tags: { name: 'health' },
  });
  check(healthRes, {
    'health check OK': (r) => r.status === 200,
  });

  // 2. Queue stats
  const statsRes = http.get(`${BASE_URL}/api/health/queue/stats`, {
    tags: { name: 'queue_stats' },
  });
  check(statsRes, {
    'queue stats OK': (r) => r.status === 200,
  });

  // 3. Submit a scan
  const scanRes = http.post(
    `${BASE_URL}/api/scanner/scan`,
    JSON.stringify({ websiteUrl: 'https://example.com' }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'scan' },
    }
  );
  
  check(scanRes, {
    'scan submitted': (r) => r.status === 200 || r.status === 201,
  });

  sleep(1);
}

export function setup() {
  console.log('=== Smoke Test ===');
  console.log(`Target: ${BASE_URL}`);
  
  // Quick health check
  const res = http.get(`${BASE_URL}/api/health`);
  if (res.status !== 200) {
    throw new Error('API health check failed');
  }
  console.log('Health check passed');
}
