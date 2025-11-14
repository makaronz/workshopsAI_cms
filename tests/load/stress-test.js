import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics for stress testing
const criticalErrors = new Rate('critical_errors');
const timeouts = new Rate('timeouts');
const memoryErrors = new Rate('memory_errors');

export const options = {
  stages: [
    { duration: '1m', target: 50 },    // Warm up
    { duration: '3m', target: 100 },   // Load to 100
    { duration: '5m', target: 200 },   // Load to 200
    { duration: '10m', target: 500 },  // Heavy load to 500
    { duration: '5m', target: 1000 }, // Stress test to 1000
    { duration: '3m', target: 2000 }, // Peak stress to 2000
    { duration: '1m', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // More lenient during stress testing
    http_req_failed: ['rate<0.2'],     // Allow 20% failure rate during stress
    critical_errors: ['rate<0.05'],     // Critical errors should be minimal
    timeouts: ['rate<0.1'],            // Timeouts should be minimal
  },
  discardResponseBodies: true, // Discard response bodies to reduce memory usage
  noConnectionReuse: false,        // Reuse connections
  insecureSkipTLSVerify: true,      // Skip TLS verification for local testing
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test scenarios for stress testing
const scenarios = {
  homepage: () => {
    const response = http.get(`${BASE_URL}/`, {
      tags: { scenario: 'homepage', type: 'read' },
    });

    return check(response, {
      'homepage accessible': (r) => r.status < 500,
      'homepage response reasonable': (r) => r.timings.duration < 5000,
    });
  },

  workshopList: () => {
    const response = http.get(`${BASE_URL}/workshops`, {
      tags: { scenario: 'workshop-list', type: 'read' },
    });

    return check(response, {
      'workshop list accessible': (r) => r.status < 500,
      'workshop list response reasonable': (r) => r.timings.duration < 3000,
    });
  },

  workshopSearch: () => {
    const searchTerms = ['javascript', 'python', 'react', 'nodejs', 'design'];
    const searchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];

    const response = http.get(`${BASE_URL}/api/workshops?search=${searchTerm}`, {
      tags: { scenario: 'workshop-search', type: 'read' },
    });

    return check(response, {
      'search API responsive': (r) => r.status < 500,
      'search response reasonable': (r) => r.timings.duration < 4000,
    });
  },

  questionnaireView: () => {
    const response = http.get(`${BASE_URL}/questionnaires`, {
      tags: { scenario: 'questionnaire-view', type: 'read' },
    });

    return check(response, {
      'questionnaire view accessible': (r) => r.status < 500,
      'questionnaire view response reasonable': (r) => r.timings.duration < 3000,
    });
  },

  analyticsDashboard: () => {
    const headers = {
      'Authorization': `Bearer ${__ENV.TEST_TOKEN || 'test-token'}`,
    };

    const response = http.get(`${BASE_URL}/api/analytics/dashboard`, {
      headers,
      tags: { scenario: 'analytics', type: 'read-auth' },
    });

    // Analytics might fail due to auth, but should not crash the server
    if (response.status >= 500) {
      criticalErrors.add(1);
    }

    return check(response, {
      'analytics does not crash server': (r) => r.status < 500,
      'analytics response reasonable': (r) => r.timings.duration < 5000,
    });
  },

  createWorkshop: () => {
    const workshopData = JSON.stringify({
      title: `Stress Test Workshop ${Date.now()}`,
      description: 'Workshop created during stress testing',
      startDate: '2024-06-01',
      endDate: '2024-06-02',
      capacity: 50,
      category: 'technical',
      level: 'intermediate'
    });

    const headers = {
      'Authorization': `Bearer ${__ENV.TEST_TOKEN || 'test-token'}`,
      'Content-Type': 'application/json',
    };

    const response = http.post(`${BASE_URL}/api/workshops`, workshopData, {
      headers,
      tags: { scenario: 'create-workshop', type: 'write-auth' },
    });

    if (response.status === 0) {
      timeouts.add(1);
    }

    return check(response, {
      'workshop creation handled gracefully': (r) => r.status < 500,
      'workshop creation response reasonable': (r) => r.timings.duration < 8000,
    });
  },
};

export default function () {
  // Randomly select scenarios to simulate realistic user behavior
  const scenarioKeys = Object.keys(scenarios);
  const selectedScenario = scenarioKeys[Math.floor(Math.random() * scenarioKeys.length)];
  const scenario = scenarios[selectedScenario];

  try {
    const success = scenario();
    if (!success) {
      criticalErrors.add(1);
    }
  } catch (error) {
    console.error(`Scenario ${selectedScenario} failed:`, error);
    criticalErrors.add(1);
  }

  // Simulate realistic user behavior with variable think times
  const thinkTime = Math.random() * 5 + 0.5; // 0.5-5.5 seconds
  sleep(thinkTime);
}

// Export custom metrics for analysis
export { criticalErrors, timeouts, memoryErrors };

// Handle cleanup and summary
export function teardown() {
  console.log('Stress test completed');
  console.log('Check custom metrics for detailed analysis');
}

// Additional function to generate load patterns
export function generateLoadPattern(userCount) {
  if (userCount < 100) {
    // Light load: mostly read operations
    return ['homepage', 'workshopList', 'workshopSearch', 'questionnaireView'];
  } else if (userCount < 500) {
    // Medium load: mix of read and write operations
    return ['homepage', 'workshopList', 'workshopSearch', 'questionnaireView', 'analyticsDashboard', 'createWorkshop'];
  } else {
    // Heavy load: all operations including stress testing
    return Object.keys(scenarios);
  }
}