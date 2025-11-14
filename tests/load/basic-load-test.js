import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics for detailed performance tracking
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],     // Error rate below 10%
    errors: ['rate<0.05'],             // Custom error rate below 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test homepage performance
  const homeResponse = http.get(`${BASE_URL}/`, {
    tags: { name: 'homepage' },
  });

  const homeSuccess = check(homeResponse, {
    'homepage status is 200': (r) => r.status === 200,
    'homepage response time < 500ms': (r) => r.timings.duration < 500,
    'homepage content-length > 0': (r) => r.body.length > 0,
  });

  if (!homeSuccess) {
    errorRate.add(1);
  }

  // Test workshop listing
  const workshopsResponse = http.get(`${BASE_URL}/api/workshops`, {
    tags: { name: 'workshops-api' },
  });

  const workshopsSuccess = check(workshopsResponse, {
    'workshops API status is 200': (r) => r.status === 200,
    'workshops API response time < 300ms': (r) => r.timings.duration < 300,
    'workshops API returns JSON': (r) => r.headers['Content-Type'].includes('application/json'),
  });

  if (!workshopsSuccess) {
    errorRate.add(1);
  }

  // Test workshop search
  const searchResponse = http.get(`${BASE_URL}/api/workshops?search=javascript`, {
    tags: { name: 'workshop-search' },
  });

  const searchSuccess = check(searchResponse, {
    'search API status is 200': (r) => r.status === 200,
    'search API response time < 400ms': (r) => r.timings.duration < 400,
    'search results contain workshops': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.data && data.data.workshops && data.data.workshops.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (!searchSuccess) {
    errorRate.add(1);
  }

  // Test questionnaire API
  const questionnaireResponse = http.get(`${BASE_URL}/api/questionnaires`, {
    tags: { name: 'questionnaires-api' },
  });

  const questionnaireSuccess = check(questionnaireResponse, {
    'questionnaires API status is 200': (r) => r.status === 200,
    'questionnaires API response time < 300ms': (r) => r.timings.duration < 300,
  });

  if (!questionnaireSuccess) {
    errorRate.add(1);
  }

  // Test analytics dashboard (requires authentication)
  const analyticsHeaders = {
    'Authorization': `Bearer ${__ENV.TEST_TOKEN || 'test-token'}`,
  'Content-Type': 'application/json',
  };

  const analyticsResponse = http.get(`${BASE_URL}/api/analytics/dashboard`, {
    headers: analyticsHeaders,
    tags: { name: 'analytics-api' },
  });

  // Analytics might fail due to auth, but we should measure its performance
  const analyticsSuccess = check(analyticsResponse, {
    'analytics API response time < 1000ms': (r) => r.timings.duration < 1000,
    'analytics API returns valid response': (r) => r.status < 500, // Accept 401 for auth errors
  });

  if (!analyticsSuccess && analyticsResponse.status >= 500) {
    errorRate.add(1);
  }

  // Test file upload performance (simulated)
  const uploadData = JSON.stringify({
    filename: 'test-workshop.json',
    content: JSON.stringify({
      title: 'Load Test Workshop',
      description: 'Workshop created during load testing',
      capacity: 50,
      startDate: '2024-06-01',
      endDate: '2024-06-02'
    })
  });

  const uploadResponse = http.post(`${BASE_URL}/api/workshops`, uploadData, {
    headers: analyticsHeaders,
    tags: { name: 'workshop-create' },
  });

  const uploadSuccess = check(uploadResponse, {
    'workshop creation response time < 2000ms': (r) => r.timings.duration < 2000,
    'workshop creation returns appropriate status': (r) => [200, 201, 400, 401].includes(r.status),
  });

  if (!uploadSuccess && uploadResponse.status >= 500) {
    errorRate.add(1);
  }

  // Simulate user think time between requests
  sleep(Math.random() * 2 + 1); // 1-3 seconds random delay
}

export function handleSummary(data) {
  return {
    'Total Requests': data.metrics.http_reqs.count,
    'Failed Requests': data.metrics.http_req_failed.count,
    'Request Duration (avg)': data.metrics.http_req_duration.avg,
    'Request Duration (95th percentile)': data.metrics.http_req_duration['p(95)'],
    'Error Rate': (data.metrics.http_req_failed.count / data.metrics.http_reqs.count * 100).toFixed(2) + '%',
    'Custom Error Rate': errorRate.rate * 100 + '%',
  };
}