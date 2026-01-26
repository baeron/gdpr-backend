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
        return body.queued !== undefined && body.processing !== undefined;
      } catch {
        return false;
      }
    },
    'has queue type': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.queueType === 'postgres' || body.queueType === 'redis';
      } catch {
        return false;
      }
    },
  });
}

export function setup() {
  console.log(`Testing queue stats endpoint: ${BASE_URL}/api/health/queue/stats`);
  
  // Verify endpoint exists
  const res = http.get(`${BASE_URL}/api/health/queue/stats`);
  if (res.status !== 200) {
    throw new Error(`Queue stats endpoint not available: ${res.status}`);
  }
  
  console.log('Queue stats response:', res.body);
}
