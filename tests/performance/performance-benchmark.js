import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Warm up
    { duration: '5m', target: 50 }, // Load test
    { duration: '10m', target: 100 }, // Stress test
    { duration: '5m', target: 200 }, // Peak load
    { duration: '5m', target: 0 }, // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<400'], // 95% of requests under 400ms
    http_req_failed: ['rate<0.1'], // Error rate less than 10%
    errors: ['rate<0.1'], // Custom error rate less than 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  // Test health endpoint
  let healthResponse = http.get(`${BASE_URL}/health`);
  let healthOk = check(healthResponse, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 50ms': (r) => r.timings.duration < 50,
  });
  errorRate.add(!healthOk);

  // Test workshops API
  let workshopsResponse = http.get(`${BASE_URL}/api/v1/workshops`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  let workshopsOk = check(workshopsResponse, {
    'workshops status is 200': (r) => r.status === 200,
    'workshops response time < 400ms': (r) => r.timings.duration < 400,
  });
  errorRate.add(!workshopsOk);

  // Test public endpoints
  let publicResponse = http.get(`${BASE_URL}/api/v1/public/workshops`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  let publicOk = check(publicResponse, {
    'public workshops status is 200': (r) => r.status === 200,
    'public workshops response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(!publicOk);

  // Sleep between iterations
  sleep(1);
}

export function handleSummary(data) {
  return {
    'performance-report.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let summary = indent + 'Performance Test Summary\n';
  summary += indent + '========================\n';
  summary += indent + 'Total requests: ' + data.metrics.http_reqs.count + '\n';
  summary += indent + 'Failed requests: ' + data.metrics.http_req_failed.count + '\n';
  summary += indent + 'Request rate: ' + data.metrics.http_reqs.rate + '/s\n';
  summary += indent + 'Average response time: ' + data.metrics.http_req_duration.avg.toFixed(2) + 'ms\n';
  summary += indent + 'P95 response time: ' + data.metrics.http_req_duration['p(95)'].toFixed(2) + 'ms\n';
  summary += indent + 'P99 response time: ' + data.metrics.http_req_duration['p(99)'].toFixed(2) + 'ms\n';
  
  if (enableColors) {
    if (data.metrics.http_req_duration['p(95)'] < 400) {
      summary += indent + '✅ P95 response time within target (<400ms)\n';
    } else {
      summary += indent + '❌ P95 response time exceeds target (>=400ms)\n';
    }
    
    if (data.metrics.http_req_failed.rate < 0.1) {
      summary += indent + '✅ Error rate within target (<10%)\n';
    } else {
      summary += indent + '❌ Error rate exceeds target (>=10%)\n';
    }
  }
  
  return summary;
}
