/**
 * K6 Load Testing Script
 *
 * Modern load testing tool with better reporting
 *
 * Installation:
 *   brew install k6  # macOS
 *   sudo apt install k6  # Linux
 *
 * Usage:
 *   k6 run load-tests/k6-load-test.js
 *   k6 run --vus 100 --duration 5m load-tests/k6-load-test.js
 *   k6 run --out json=results.json load-tests/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Test configuration
export const options = {
  // Test stages - ramp up and down
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 VUs
    { duration: '1m', target: 50 },    // Ramp up to 50 VUs
    { duration: '3m', target: 50 },    // Stay at 50 VUs for 3 minutes
    { duration: '1m', target: 100 },   // Ramp up to 100 VUs
    { duration: '2m', target: 100 },   // Stay at 100 VUs for 2 minutes
    { duration: '30s', target: 0 },    // Ramp down to 0 VUs
  ],

  // Performance thresholds
  thresholds: {
    'http_req_duration': ['p(95)<200', 'p(99)<500'], // 95% < 200ms, 99% < 500ms
    'http_req_failed': ['rate<0.01'],                 // Error rate < 1%
    'errors': ['rate<0.01'],                          // Custom error rate < 1%
  },

  // HTTP settings
  noConnectionReuse: false,
  userAgent: 'K6 Load Test',
};

// Base URL
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Test data
const testUsers = [
  { email: 'test1@example.com', password: 'password123' },
  { email: 'test2@example.com', password: 'password123' },
  { email: 'test3@example.com', password: 'password123' },
];

/**
 * Main test function - runs for each virtual user
 */
export default function () {
  // Select random test user
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];

  // Test scenario 1: Health check
  testHealthCheck();
  sleep(0.5);

  // Test scenario 2: Authentication (20% of requests)
  if (Math.random() < 0.2) {
    const token = testAuthentication(user);
    if (token) {
      // Authenticated requests
      testDashboardLoad(token);
      sleep(1);
      testAgentOperations(token);
      sleep(1);
      testKnowledgeBase(token);
    }
  }

  // Test scenario 3: Public endpoints (80% of requests)
  testPublicEndpoints();

  sleep(Math.random() * 2 + 1); // Random sleep 1-3 seconds
}

/**
 * Test 1: Health Check
 */
function testHealthCheck() {
  const res = http.get(`${BASE_URL}/health`);

  const success = check(res, {
    'health check status is 200': (r) => r.status === 200,
    'health check has status': (r) => r.json('status') !== undefined,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  });

  errorRate.add(!success);
  apiDuration.add(res.timings.duration);

  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
  }
}

/**
 * Test 2: Authentication
 */
function testAuthentication(user) {
  const payload = JSON.stringify({
    email: user.email,
    password: user.password,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/api/auth/login`, payload, params);

  const success = check(res, {
    'login status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'login response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!success);
  apiDuration.add(res.timings.duration);

  if (res.status === 200) {
    successfulRequests.add(1);
    return res.json('token');
  } else {
    failedRequests.add(1);
    return null;
  }
}

/**
 * Test 3: Dashboard Load
 */
function testDashboardLoad(token) {
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  // Test multiple dashboard endpoints in parallel
  const responses = http.batch([
    ['GET', `${BASE_URL}/api/analytics/overview`, null, params],
    ['GET', `${BASE_URL}/api/call-logs?page=1&limit=50`, null, params],
    ['GET', `${BASE_URL}/api/agents`, null, params],
  ]);

  responses.forEach((res) => {
    const success = check(res, {
      'dashboard endpoint status is 200': (r) => r.status === 200,
      'dashboard endpoint response time < 300ms': (r) => r.timings.duration < 300,
    });

    errorRate.add(!success);
    apiDuration.add(res.timings.duration);

    if (success) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
    }
  });
}

/**
 * Test 4: Agent Operations
 */
function testAgentOperations(token) {
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const res = http.get(`${BASE_URL}/api/agents`, params);

  const success = check(res, {
    'agents list status is 200': (r) => r.status === 200,
    'agents list response time < 200ms': (r) => r.timings.duration < 200,
  });

  errorRate.add(!success);
  apiDuration.add(res.timings.duration);

  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
  }
}

/**
 * Test 5: Knowledge Base
 */
function testKnowledgeBase(token) {
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  // Test stats endpoint
  const statsRes = http.get(`${BASE_URL}/api/knowledge-base/stats`, params);

  const statsSuccess = check(statsRes, {
    'kb stats status is 200': (r) => r.status === 200,
    'kb stats response time < 200ms': (r) => r.timings.duration < 200,
  });

  errorRate.add(!statsSuccess);
  apiDuration.add(statsRes.timings.duration);

  if (statsSuccess) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
  }

  // Test search endpoint
  const searchPayload = JSON.stringify({
    query: 'test query',
    maxResults: 10,
  });

  const searchRes = http.post(`${BASE_URL}/api/knowledge-base/search`, searchPayload, params);

  const searchSuccess = check(searchRes, {
    'kb search status is 200 or 400': (r) => r.status === 200 || r.status === 400,
    'kb search response time < 300ms': (r) => r.timings.duration < 300,
  });

  errorRate.add(!searchSuccess);
  apiDuration.add(searchRes.timings.duration);

  if (searchSuccess) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
  }
}

/**
 * Test 6: Public Endpoints
 */
function testPublicEndpoints() {
  const endpoints = [
    '/health',
    '/api/integrations',
    '/api/providers',
  ];

  const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${randomEndpoint}`);

  const success = check(res, {
    'public endpoint returns valid response': (r) => r.status >= 200 && r.status < 500,
    'public endpoint response time < 200ms': (r) => r.timings.duration < 200,
  });

  errorRate.add(!success);
  apiDuration.add(res.timings.duration);

  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
  }
}

/**
 * Setup function - runs once before test
 */
export function setup() {
  console.log('Starting load test...');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Test duration: ~8 minutes`);
  console.log(`Max concurrent users: 100`);
}

/**
 * Teardown function - runs once after test
 */
export function teardown(data) {
  console.log('Load test completed!');
  console.log('Check the summary report above for detailed metrics.');
}

/**
 * Handle summary - custom reporting
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const metrics = data.metrics;

  let summary = '\n';
  summary += '='.repeat(60) + '\n';
  summary += '  LOAD TEST SUMMARY\n';
  summary += '='.repeat(60) + '\n\n';

  summary += `Total Requests: ${metrics.http_reqs.values.count}\n`;
  summary += `Successful: ${metrics.successful_requests ? metrics.successful_requests.values.count : 'N/A'}\n`;
  summary += `Failed: ${metrics.failed_requests ? metrics.failed_requests.values.count : 'N/A'}\n`;
  summary += `Error Rate: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n\n`;

  summary += `Response Time (p95): ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `Response Time (p99): ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
  summary += `Response Time (avg): ${metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `Response Time (max): ${metrics.http_req_duration.values.max.toFixed(2)}ms\n\n`;

  summary += `Request Rate: ${metrics.http_reqs.values.rate.toFixed(2)} req/s\n`;
  summary += `Data Received: ${(metrics.data_received.values.count / 1024 / 1024).toFixed(2)} MB\n`;
  summary += `Data Sent: ${(metrics.data_sent.values.count / 1024 / 1024).toFixed(2)} MB\n\n`;

  summary += '='.repeat(60) + '\n';

  // Check if thresholds passed
  const allPassed = Object.keys(data.metrics).every(metricName => {
    const metric = data.metrics[metricName];
    if (!metric.thresholds) return true;

    return Object.keys(metric.thresholds).every(thresholdName => {
      return metric.thresholds[thresholdName].ok;
    });
  });

  if (allPassed) {
    summary += '  ✅ ALL THRESHOLDS PASSED\n';
  } else {
    summary += '  ❌ SOME THRESHOLDS FAILED\n';
  }

  summary += '='.repeat(60) + '\n';

  return summary;
}
