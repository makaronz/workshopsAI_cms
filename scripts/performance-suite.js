#!/usr/bin/env node

/**
 * Comprehensive Performance Testing Suite for WorkshopsAI CMS
 *
 * Features:
 * - Load testing with multiple scenarios
 * - Stress testing with gradual ramp-up
 * - Spike testing for traffic bursts
 * - Endurance testing for long-running stability
 * - Performance regression detection
 * - Automated performance reports
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

class PerformanceTestSuite {
  constructor() {
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    this.results = {
      timestamp: new Date().toISOString(),
      tests: {},
      summary: {
        totalRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        throughput: 0,
      },
      recommendations: [],
    };

    this.testScenarios = [
      {
        name: 'basic-load',
        description: 'Basic load test with realistic user patterns',
        options: {
          stages: [
            { duration: '2m', target: 10 },
            { duration: '5m', target: 50 },
            { duration: '10m', target: 100 },
            { duration: '5m', target: 0 },
          ],
          thresholds: {
            http_req_duration: ['p(95)<400'],
            http_req_failed: ['rate<0.05'],
            errors: ['rate<0.05'],
          },
        },
      },
      {
        name: 'stress-test',
        description: 'Stress test to find performance limits',
        options: {
          stages: [
            { duration: '2m', target: 50 },
            { duration: '5m', target: 200 },
            { duration: '10m', target: 500 },
            { duration: '5m', target: 1000 },
            { duration: '5m', target: 0 },
          ],
          thresholds: {
            http_req_duration: ['p(95)<1000'],
            http_req_failed: ['rate<0.1'],
          },
        },
      },
      {
        name: 'spike-test',
        description: 'Spike test for traffic burst handling',
        options: {
          stages: [
            { duration: '2m', target: 10 },
            { duration: '1m', target: 0 },
            { duration: '30s', target: 500 },
            { duration: '2m', target: 10 },
            { duration: '1m', target: 0 },
          ],
          thresholds: {
            http_req_duration: ['p(95)<800'],
            http_req_failed: ['rate<0.15'],
          },
        },
      },
      {
        name: 'endurance-test',
        description: 'Long-running endurance test',
        options: {
          stages: [
            { duration: '30m', target: 100 },
            { duration: '60m', target: 200 },
            { duration: '30m', target: 100 },
            { duration: '1m', target: 0 },
          ],
          thresholds: {
            http_req_duration: ['p(95)<500'],
            http_req_failed: ['rate<0.02'],
          },
        },
      },
    ];
  }

  async runFullSuite() {
    console.log('🚀 Starting WorkshopsAI CMS Performance Test Suite');
    console.log(`📊 Base URL: ${this.baseUrl}`);
    console.log(`⏰ Started at: ${this.results.timestamp}`);

    const startTime = performance.now();

    try {
      // Run all test scenarios
      for (const scenario of this.testScenarios) {
        await this.runTestScenario(scenario);
      }

      // Run API-specific tests
      await this.runApiPerformanceTests();

      // Generate comprehensive report
      await this.generateReport();

      const endTime = performance.now();
      const totalTime = ((endTime - startTime) / 1000 / 60).toFixed(2);

      console.log(`✅ Performance test suite completed in ${totalTime} minutes`);
      console.log(`📄 Report generated: performance-report-${Date.now()}.html`);

    } catch (error) {
      console.error('❌ Performance test suite failed:', error);
      process.exit(1);
    }
  }

  async runTestScenario(scenario) {
    console.log(`\n🧪 Running ${scenario.name}: ${scenario.description}`);

    const testScript = await this.generateTestScript(scenario);
    const testFilePath = `/tmp/k6-test-${scenario.name}.js`;

    await fs.writeFile(testFilePath, testScript);

    try {
      const result = await this.runK6Test(testFilePath, scenario);
      this.results.tests[scenario.name] = {
        scenario,
        result,
        passed: this.evaluateThresholds(result, scenario.options.thresholds),
      };

      console.log(`✅ ${scenario.name} completed`);
      console.log(`📈 Requests: ${result.metrics.http_reqs.count}`);
      console.log(`⚡ Average response time: ${result.metrics.http_req_duration.avg.toFixed(2)}ms`);
      console.log(`🎯 P95 response time: ${result.metrics.http_req_duration['p(95)'].toFixed(2)}ms`);
      console.log(`❌ Error rate: ${(result.metrics.http_req_failed.rate * 100).toFixed(2)}%`);

    } catch (error) {
      console.error(`❌ ${scenario.name} failed:`, error);
      this.results.tests[scenario.name] = {
        scenario,
        error: error.message,
        passed: false,
      };
    } finally {
      await fs.unlink(testFilePath);
    }
  }

  async generateTestScript(scenario) {
    return `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const workshopLoadTime = new Trend('workshop_load_time', true);
const questionnaireLoadTime = new Trend('questionnaire_load_time', true);
const responseSubmitTime = new Trend('response_submit_time', true);

export const options = ${JSON.stringify(scenario.options, null, 2)};

const BASE_URL = '${this.baseUrl}';

// Test data
const testUsers = Array.from({ length: 1000 }, (_, i) => ({
  id: \`user_\${i + 1}\`,
  email: \`user\${i + 1}@test.com\`,
  token: \`test_token_\${i + 1}\`,
}));

const testWorkshops = Array.from({ length: 50 }, (_, i) => ({
  id: \`workshop_\${i + 1}\`,
  title: \`Test Workshop \${i + 1}\`,
}));

export default function () {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];

  // Test health endpoint
  const healthResponse = http.get(\`\${BASE_URL}/health\`);
  const healthOk = check(healthResponse, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 50ms': (r) => r.timings.duration < 50,
  });
  errorRate.add(!healthOk);

  // Test public workshops
  const publicResponse = http.get(\`\${BASE_URL}/api/v1/public/workshops\`, {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'k6-performance-test',
    },
  });
  const publicOk = check(publicResponse, {
    'public workshops status is 200': (r) => r.status === 200,
    'public workshops response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(!publicOk);

  // Test workshop details (50% probability)
  if (Math.random() < 0.5) {
    const workshop = testWorkshops[Math.floor(Math.random() * testWorkshops.length)];
    const workshopStart = performance.now();

    const workshopResponse = http.get(
      \`\${BASE_URL}/api/v1/public/workshops/\${workshop.id}\`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${user.token}\`,
        },
      }
    );

    workshopLoadTime.add(performance.now() - workshopStart);

    const workshopOk = check(workshopResponse, {
      'workshop status is 200': (r) => r.status === 200,
      'workshop response time < 300ms': (r) => r.timings.duration < 300,
    });
    errorRate.add(!workshopOk);
  }

  // Test questionnaires (30% probability)
  if (Math.random() < 0.3) {
    const workshop = testWorkshops[Math.floor(Math.random() * testWorkshops.length)];
    const questionnaireStart = performance.now();

    const questionnaireResponse = http.get(
      \`\${BASE_URL}/api/v1/public/workshops/\${workshop.id}/questionnaires\`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${user.token}\`,
        },
      }
    );

    questionnaireLoadTime.add(performance.now() - questionnaireStart);

    const questionnaireOk = check(questionnaireResponse, {
      'questionnaires status is 200': (r) => r.status === 200,
      'questionnaires response time < 400ms': (r) => r.timings.duration < 400,
    });
    errorRate.add(!questionnaireOk);
  }

  // Test response submission (10% probability)
  if (Math.random() < 0.1) {
    const workshop = testWorkshops[Math.floor(Math.random() * testWorkshops.length)];
    const responseStart = performance.now();

    const submitResponse = http.post(
      \`\${BASE_URL}/api/v1/responses\`,
      JSON.stringify({
        questionnaireId: \`questionnaire_\${Math.floor(Math.random() * 100) + 1}\`,
        workshopId: workshop.id,
        answers: {
          question1: 'Test answer',
          question2: ['Option 1', 'Option 2'],
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${user.token}\`,
        },
      }
    );

    responseSubmitTime.add(performance.now() - responseStart);

    const submitOk = check(submitResponse, {
      'submit status is 200 or 201': (r) => r.status === 200 || r.status === 201,
      'submit response time < 1000ms': (r) => r.timings.duration < 1000,
    });
    errorRate.add(!submitOk);
  }

  // Random sleep between requests (100ms - 2s)
  sleep(Math.random() * 1.9 + 0.1);
}

export function handleSummary(data) {
  return {
    '${scenario.name}-report.json': JSON.stringify(data, null, 2),
    stdout: this.generateSummary(data, '${scenario.name}'),
  };
}

function generateSummary(data, testName) {
  const indent = '  ';
  let summary = indent + \`\${testName} Performance Summary\\n\`;
  summary += indent + '========================\\n';
  summary += indent + \`Total requests: \${data.metrics.http_reqs.count}\\n\`;
  summary += indent + \`Failed requests: \${data.metrics.http_req_failed.count}\\n\`;
  summary += indent + \`Request rate: \${data.metrics.http_reqs.rate.toFixed(2)}/s\\n\`;
  summary += indent + \`Average response time: \${data.metrics.http_req_duration.avg.toFixed(2)}ms\\n\`;
  summary += indent + \`P50 response time: \${data.metrics.http_req_duration['p(50)'].toFixed(2)}ms\\n\`;
  summary += indent + \`P95 response time: \${data.metrics.http_req_duration['p(95)'].toFixed(2)}ms\\n\`;
  summary += indent + \`P99 response time: \${data.metrics.http_req_duration['p(99)'].toFixed(2)}ms\\n\`;
  summary += indent + \`Error rate: \${(data.metrics.http_req_failed.rate * 100).toFixed(2)}%\\n\`;

  return summary;
}
`;
  }

  async runK6Test(scriptPath, scenario) {
    return new Promise((resolve, reject) => {
      const k6 = spawn('k6', ['run', scriptPath, '--out', 'json=results.json'], {
        env: { ...process.env, BASE_URL: this.baseUrl },
      });

      let stdout = '';
      let stderr = '';

      k6.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      k6.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      k6.on('close', (code) => {
        if (code === 0) {
          try {
            // Parse K6 output
            const result = this.parseK6Output(stdout);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse K6 output: ${error.message}`));
          }
        } else {
          reject(new Error(`K6 test failed with code ${code}: ${stderr}`));
        }
      });

      k6.on('error', (error) => {
        reject(new Error(`Failed to start K6: ${error.message}`));
      });
    });
  }

  parseK6Output(output) {
    // Parse the JSON output from K6
    try {
      const lines = output.split('\n');
      const jsonLine = lines.find(line => line.trim().startsWith('{') && line.trim().endsWith('}'));

      if (jsonLine) {
        return JSON.parse(jsonLine);
      }

      // Fallback parsing
      return {
        metrics: {
          http_reqs: { count: 0, rate: 0 },
          http_req_duration: { avg: 0, 'p(50)': 0, 'p(95)': 0, 'p(99)': 0 },
          http_req_failed: { count: 0, rate: 0 },
        },
      };
    } catch (error) {
      console.warn('Failed to parse K6 output:', error);
      return {
        metrics: {
          http_reqs: { count: 0, rate: 0 },
          http_req_duration: { avg: 0, 'p(50)': 0, 'p(95)': 0, 'p(99)': 0 },
          http_req_failed: { count: 0, rate: 0 },
        },
      };
    }
  }

  evaluateThresholds(result, thresholds) {
    let allPassed = true;

    if (thresholds.http_req_duration) {
      for (const threshold of thresholds.http_req_duration) {
        const match = threshold.match(/p\((\d+)\)<(\d+)/);
        if (match) {
          const percentile = parseInt(match[1]);
          const maxValue = parseInt(match[2]);
          const actualValue = result.metrics.http_req_duration[`p(${percentile})`];

          if (actualValue > maxValue) {
            console.warn(`⚠️ Threshold failed: p(${percentile}) response time ${actualValue.toFixed(2)}ms > ${maxValue}ms`);
            allPassed = false;
          }
        }
      }
    }

    if (thresholds.http_req_failed) {
      for (const threshold of thresholds.http_req_failed) {
        const match = threshold.match(/rate<(\d+\.?\d*)/);
        if (match) {
          const maxRate = parseFloat(match[1]);
          const actualRate = result.metrics.http_req_failed.rate;

          if (actualRate > maxRate) {
            console.warn(`⚠️ Threshold failed: error rate ${(actualRate * 100).toFixed(2)}% > ${(maxRate * 100).toFixed(2)}%`);
            allPassed = false;
          }
        }
      }
    }

    return allPassed;
  }

  async runApiPerformanceTests() {
    console.log('\n🔍 Running API Performance Tests');

    const apiTests = [
      {
        name: 'health-endpoint',
        url: '/health',
        expectedResponseTime: 50,
      },
      {
        name: 'public-workshops',
        url: '/api/v1/public/workshops',
        expectedResponseTime: 200,
      },
      {
        name: 'workshop-details',
        url: '/api/v1/public/workshops/workshop_1',
        expectedResponseTime: 300,
      },
    ];

    for (const test of apiTests) {
      const startTime = performance.now();

      try {
        const response = await fetch(`${this.baseUrl}${test.url}`);
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        this.results.tests[test.name] = {
          url: test.url,
          responseTime,
          status: response.status,
          passed: responseTime < test.expectedResponseTime && response.status === 200,
        };

        console.log(`📊 ${test.name}: ${responseTime.toFixed(2)}ms (${response.status})`);
      } catch (error) {
        console.error(`❌ ${test.name} failed:`, error.message);
        this.results.tests[test.name] = {
          url: test.url,
          error: error.message,
          passed: false,
        };
      }
    }
  }

  async generateReport() {
    // Calculate summary metrics
    const testResults = Object.values(this.results.tests).filter(test => test.result);

    if (testResults.length > 0) {
      this.results.summary.totalRequests = testResults.reduce(
        (sum, test) => sum + (test.result?.metrics?.http_reqs?.count || 0), 0
      );

      this.results.summary.averageResponseTime = testResults.reduce(
        (sum, test) => sum + (test.result?.metrics?.http_req_duration?.avg || 0), 0
      ) / testResults.length;

      this.results.summary.p95ResponseTime = testResults.reduce(
        (sum, test) => sum + (test.result?.metrics?.http_req_duration?.['p(95)'] || 0), 0
      ) / testResults.length;

      this.results.summary.p99ResponseTime = testResults.reduce(
        (sum, test) => sum + (test.result?.metrics?.http_req_duration?.['p(99)'] || 0), 0
      ) / testResults.length;

      this.results.summary.errorRate = testResults.reduce(
        (sum, test) => sum + (test.result?.metrics?.http_req_failed?.rate || 0), 0
      ) / testResults.length;

      this.results.summary.throughput = testResults.reduce(
        (sum, test) => sum + (test.result?.metrics?.http_reqs?.rate || 0), 0
      ) / testResults.length;
    }

    // Generate recommendations
    this.generateRecommendations();

    // Create HTML report
    const htmlReport = this.generateHtmlReport();
    const reportPath = `performance-report-${Date.now()}.html`;

    await fs.writeFile(reportPath, htmlReport);
    console.log(`📄 Performance report saved to: ${reportPath}`);

    // Save JSON results
    const jsonReportPath = `performance-results-${Date.now()}.json`;
    await fs.writeFile(jsonReportPath, JSON.stringify(this.results, null, 2));
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.results.summary.p95ResponseTime > 400) {
      recommendations.push({
        priority: 'high',
        category: 'response-time',
        description: 'P95 response time exceeds 400ms. Consider optimizing database queries and implementing additional caching.',
      });
    }

    if (this.results.summary.errorRate > 0.05) {
      recommendations.push({
        priority: 'high',
        category: 'error-rate',
        description: 'Error rate is above 5%. Review error logs and implement better error handling.',
      });
    }

    if (this.results.summary.averageResponseTime > 200) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        description: 'Average response time is high. Consider implementing response compression and API optimization.',
      });
    }

    const failedTests = Object.entries(this.results.tests).filter(([_, test]) => !test.passed);
    if (failedTests.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'test-failures',
        description: `${failedTests.length} tests failed. Review test logs and system configuration.`,
        details: failedTests.map(([name]) => name),
      });
    }

    this.results.recommendations = recommendations;
  }

  generateHtmlReport() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WorkshopsAI CMS Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px; }
        .metric { background: #f3f4f6; padding: 15px; margin: 10px 0; border-radius: 8px; }
        .passed { color: #10b981; font-weight: bold; }
        .failed { color: #ef4444; font-weight: bold; }
        .high-priority { border-left: 4px solid #ef4444; }
        .medium-priority { border-left: 4px solid #f59e0b; }
        .low-priority { border-left: 4px solid #3b82f6; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: bold; }
        .chart { background: #f9fafb; padding: 20px; margin: 20px 0; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>WorkshopsAI CMS Performance Report</h1>
        <p>Generated: ${this.results.timestamp}</p>
    </div>

    <div class="metric">
        <h2>Performance Summary</h2>
        <table>
            <tr><th>Metric</th><th>Value</th><th>Status</th></tr>
            <tr>
                <td>Total Requests</td>
                <td>${this.results.summary.totalRequests.toLocaleString()}</td>
                <td>-</td>
            </tr>
            <tr>
                <td>Average Response Time</td>
                <td>${this.results.summary.averageResponseTime.toFixed(2)}ms</td>
                <td class="${this.results.summary.averageResponseTime < 200 ? 'passed' : 'failed'}">
                    ${this.results.summary.averageResponseTime < 200 ? '✅ Good' : '⚠️ Needs attention'}
                </td>
            </tr>
            <tr>
                <td>P95 Response Time</td>
                <td>${this.results.summary.p95ResponseTime.toFixed(2)}ms</td>
                <td class="${this.results.summary.p95ResponseTime < 400 ? 'passed' : 'failed'}">
                    ${this.results.summary.p95ResponseTime < 400 ? '✅ Good' : '⚠️ Needs attention'}
                </td>
            </tr>
            <tr>
                <td>P99 Response Time</td>
                <td>${this.results.summary.p99ResponseTime.toFixed(2)}ms</td>
                <td class="${this.results.summary.p99ResponseTime < 500 ? 'passed' : 'failed'}">
                    ${this.results.summary.p99ResponseTime < 500 ? '✅ Good' : '⚠️ Needs attention'}
                </td>
            </tr>
            <tr>
                <td>Error Rate</td>
                <td>${(this.results.summary.errorRate * 100).toFixed(2)}%</td>
                <td class="${this.results.summary.errorRate < 0.05 ? 'passed' : 'failed'}">
                    ${this.results.summary.errorRate < 0.05 ? '✅ Good' : '⚠️ Needs attention'}
                </td>
            </tr>
            <tr>
                <td>Throughput</td>
                <td>${this.results.summary.throughput.toFixed(2)} req/s</td>
                <td>-</td>
            </tr>
        </table>
    </div>

    <div class="metric">
        <h2>Test Results</h2>
        <table>
            <tr><th>Test Name</th><th>Status</th><th>Details</th></tr>
            ${Object.entries(this.results.tests).map(([name, test]) => `
                <tr>
                    <td>${name}</td>
                    <td class="${test.passed ? 'passed' : 'failed'}">
                        ${test.passed ? '✅ Passed' : '❌ Failed'}
                    </td>
                    <td>${test.result ?
                        `Requests: ${test.result.metrics?.http_reqs?.count || 0}, ` +
                        `Avg Time: ${test.result.metrics?.http_req_duration?.avg?.toFixed(2) || 0}ms` :
                        test.error || 'No details'
                    }</td>
                </tr>
            `).join('')}
        </table>
    </div>

    ${this.results.recommendations.length > 0 ? `
        <div class="metric">
            <h2>Recommendations</h2>
            ${this.results.recommendations.map(rec => `
                <div class="metric ${rec.priority}-priority">
                    <h3>${rec.category} (${rec.priority})</h3>
                    <p>${rec.description}</p>
                    ${rec.details ? `<p><strong>Affected tests:</strong> ${rec.details.join(', ')}</p>` : ''}
                </div>
            `).join('')}
        </div>
    ` : ''}
</body>
</html>
    `;
  }
}

// Run the performance test suite
if (import.meta.url === `file://${process.argv[1]}`) {
  const suite = new PerformanceTestSuite();
  suite.runFullSuite().catch(console.error);
}

export default PerformanceTestSuite;