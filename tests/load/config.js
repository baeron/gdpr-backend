// Shared configuration for k6 load tests

export const environments = {
  local: 'http://localhost:3000',
  dev: 'https://api.dev.policytracker.eu',
  prod: 'https://api.policytracker.eu',
};

export const testWebsites = [
  'https://example.com',
  'https://httpbin.org',
  'https://jsonplaceholder.typicode.com',
];

export const thresholds = {
  // Response time thresholds
  smoke: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
  },
  load: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
  stress: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.1'],
  },
};

// Load profiles
export const profiles = {
  // Quick smoke test
  smoke: {
    vus: 5,
    duration: '30s',
  },
  // Light load
  light: {
    vus: 10,
    duration: '2m',
  },
  // Normal load
  normal: {
    vus: 50,
    duration: '5m',
  },
  // Heavy load
  heavy: {
    vus: 100,
    duration: '10m',
  },
  // Stress test
  stress: {
    vus: 200,
    duration: '15m',
  },
};
