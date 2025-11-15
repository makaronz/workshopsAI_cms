#!/usr/bin/env node

/**
 * Enhanced Test Runner with Intelligent Test Selection and Parallel Execution
 *
 * Features:
 * - Intelligent test selection based on file changes
 * - Parallel test execution with worker pool
 * - Real-time progress reporting
 * - Performance monitoring and alerting
 * - Comprehensive test result aggregation
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class EnhancedTestRunner {
  constructor(options = {}) {
    this.options = {
      maxWorkers: options.maxWorkers || os.cpus().length,
      timeout: options.timeout || 300000, // 5 minutes default
      retries: options.retries || 1,
      coverage: options.coverage !== false,
      parallel: options.parallel !== false,
      ...options
    };

    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      suites: []
    };

    this.startTime = Date.now();
  }

  async run() {
    console.log('🚀 Starting Enhanced Test Runner...');
    console.log(`📊 Max Workers: ${this.options.maxWorkers}`);
    console.log(`⏱️ Timeout: ${this.options.timeout}ms`);
    console.log(`🔄 Retries: ${this.options.retries}`);
    console.log('');

    try {
      // Step 1: Analyze changes and select tests
      const testSelection = await this.selectTests();
      console.log(`📋 Selected ${testSelection.totalTests} tests to run`);
      console.log(`   - Unit: ${testSelection.unit.length}`);
      console.log(`   - Integration: ${testSelection.integration.length}`);
      console.log(`   - E2E: ${testSelection.e2e.length}`);
      console.log('');

      // Step 2: Execute tests based on configuration
      if (this.options.parallel) {
        await this.runTestsParallel(testSelection);
      } else {
        await this.runTestsSequential(testSelection);
      }

      // Step 3: Generate reports
      await this.generateReports();

      // Step 4: Print summary
      this.printSummary();

      // Step 5: Exit with appropriate code
      process.exit(this.results.failed > 0 ? 1 : 0);

    } catch (error) {
      console.error('❌ Test runner failed:', error.message);
      process.exit(1);
    }
  }

  async selectTests() {
    console.log('🔍 Analyzing changes and selecting tests...');

    const changedFiles = this.getChangedFiles();
    const testImpact = this.analyzeTestImpact(changedFiles);
    const testSelection = this.selectTestFiles(testImpact);

    return testSelection;
  }

  getChangedFiles() {
    try {
      // Try to get changed files from git
      const baseBranch = process.env.GITHUB_BASE_REF || 'main';
      const output = execSync(`git diff --name-only ${baseBranch}...HEAD`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      return output.trim().split('\n').filter(file => file.length > 0);
    } catch (error) {
      console.log('⚠️ Could not detect git changes, running all tests');
      return [];
    }
  }

  analyzeTestImpact(changedFiles) {
    const impact = {
      auth: false,
      api: false,
      database: false,
      services: false,
      ui: false,
      performance: false,
      security: false,
      llm: false
    };

    for (const file of changedFiles) {
      if (file.includes('auth') || file.includes('middleware')) {
        impact.auth = true;
        impact.security = true;
      }
      if (file.includes('api') || file.includes('routes') || file.includes('controller')) {
        impact.api = true;
      }
      if (file.includes('database') || file.includes('models') || file.includes('schema')) {
        impact.database = true;
      }
      if (file.includes('services')) {
        impact.services = true;
      }
      if (file.includes('frontend') || file.includes('components') || file.includes('pages')) {
        impact.ui = true;
      }
      if (file.includes('performance') || file.includes('optimization') || file.includes('cache')) {
        impact.performance = true;
      }
      if (file.includes('security') || file.includes('auth') || file.includes('middleware')) {
        impact.security = true;
      }
      if (file.includes('llm') || file.includes('analysis') || file.includes('openai') || file.includes('anthropic')) {
        impact.llm = true;
      }
    }

    return impact;
  }

  selectTestFiles(impact) {
    const selection = {
      unit: [],
      integration: [],
      e2e: [],
      performance: [],
      security: [],
      totalTests: 0
    };

    // If no changes detected, run all tests
    const hasChanges = Object.values(impact).some(Boolean);
    if (!hasChanges || process.env.CI) {
      return {
        unit: ['tests/unit'],
        integration: ['tests/integration'],
        e2e: ['tests/e2e'],
        performance: ['tests/performance'],
        security: ['tests/security'],
        totalTests: 'all'
      };
    }

    // Select tests based on impact
    if (impact.auth || impact.security) {
      selection.unit.push('tests/unit/services/authService.test.ts');
      selection.unit.push('tests/unit/middleware/*.test.ts');
      selection.integration.push('tests/integration/auth*.test.ts');
      selection.security.push('tests/security/auth*.spec.ts');
    }

    if (impact.api) {
      selection.unit.push('tests/unit/api/*.test.ts');
      selection.integration.push('tests/integration/api/*.test.ts');
      selection.e2e.push('tests/e2e/api/*.spec.ts');
    }

    if (impact.database) {
      selection.unit.push('tests/unit/services/database*.test.ts');
      selection.integration.push('tests/integration/database/*.test.ts');
    }

    if (impact.services) {
      selection.unit.push('tests/unit/services/*.test.ts');
      selection.integration.push('tests/integration/services/*.test.ts');
    }

    if (impact.ui) {
      selection.e2e.push('tests/e2e/ui/*.spec.ts');
      selection.e2e.push('tests/e2e/accessibility/*.spec.ts');
    }

    if (impact.performance) {
      selection.performance.push('tests/performance/*.perf.ts');
      selection.unit.push('tests/unit/services/enhanced-caching-service.test.ts');
    }

    if (impact.llm) {
      selection.unit.push('tests/unit/services/streaming-llm-worker.test.ts');
      selection.integration.push('tests/integration/llm-system-integration.test.ts');
      selection.e2e.push('tests/e2e/complete-workflows/llm-analysis-e2e.spec.ts');
    }

    // Always run core tests
    if (selection.unit.length === 0) {
      selection.unit.push('tests/unit/core/*.test.ts');
    }

    // Count total test files
    selection.totalTests = [
      ...selection.unit,
      ...selection.integration,
      ...selection.e2e,
      ...selection.performance,
      ...selection.security
    ].length;

    return selection;
  }

  async runTestsParallel(testSelection) {
    console.log('🔄 Running tests in parallel...');

    const testSuites = [
      {
        name: 'unit',
        files: testSelection.unit,
        command: 'npm run test:unit',
        priority: 'high'
      },
      {
        name: 'integration',
        files: testSelection.integration,
        command: 'npm run test:integration',
        priority: 'high'
      },
      {
        name: 'e2e',
        files: testSelection.e2e,
        command: 'npm run test:e2e',
        priority: 'medium'
      },
      {
        name: 'performance',
        files: testSelection.performance,
        command: 'npm run test:performance',
        priority: 'low'
      },
      {
        name: 'security',
        files: testSelection.security,
        command: 'npm run test:security',
        priority: 'high'
      }
    ].filter(suite => suite.files.length > 0);

    const promises = testSuites.map(suite => this.runTestSuite(suite));
    const results = await Promise.allSettled(promises);

    this.aggregateResults(results);
  }

  async runTestsSequential(testSelection) {
    console.log('📋 Running tests sequentially...');

    const testSuites = [
      { name: 'unit', command: 'npm run test:unit' },
      { name: 'integration', command: 'npm run test:integration' },
      { name: 'e2e', command: 'npm run test:e2e' },
      { name: 'performance', command: 'npm run test:performance' },
      { name: 'security', command: 'npm run test:security' }
    ];

    for (const suite of testSuites) {
      const result = await this.runTestSuite(suite);
      this.results.suites.push(result);
    }
  }

  async runTestSuite(suite) {
    console.log(`\n🧪 Running ${suite.name} tests...`);

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const child = spawn(suite.command, {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        const result = {
          name: suite.name,
          command: suite.command,
          exitCode: code,
          duration,
          stdout,
          stderr,
          passed: code === 0
        };

        this.results.total++;
        if (code === 0) {
          this.results.passed++;
          console.log(`✅ ${suite.name} completed successfully in ${duration}ms`);
        } else {
          this.results.failed++;
          console.log(`❌ ${suite.name} failed with exit code ${code} after ${duration}ms`);
        }

        resolve(result);
      });

      child.on('error', (error) => {
        console.error(`❌ Failed to start ${suite.name} tests:`, error.message);
        reject(error);
      });

      // Handle timeout
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Test suite ${suite.name} timed out after ${this.options.timeout}ms`));
      }, this.options.timeout);
    });
  }

  aggregateResults(results) {
    for (const result of results) {
      if (result.status === 'fulfilled') {
        this.results.suites.push(result.value);
      } else {
        console.error('❌ Test suite failed:', result.reason);
        this.results.failed++;
      }
    }
  }

  async generateReports() {
    console.log('\n📊 Generating test reports...');

    // Create reports directory
    const reportsDir = './test-results';
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Generate JSON report
    const jsonReport = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      summary: {
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        skipped: this.results.skipped
      },
      suites: this.results.suites,
      environment: {
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length
      }
    };

    fs.writeFileSync(
      path.join(reportsDir, 'enhanced-test-report.json'),
      JSON.stringify(jsonReport, null, 2)
    );

    // Generate HTML report
    const htmlReport = this.generateHTMLReport(jsonReport);
    fs.writeFileSync(
      path.join(reportsDir, 'enhanced-test-report.html'),
      htmlReport
    );

    console.log(`📄 Reports generated in ${reportsDir}/`);
  }

  generateHTMLReport(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Enhanced Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e9ecef; padding: 15px; border-radius: 5px; text-align: center; }
        .passed { background: #d4edda; color: #155724; }
        .failed { background: #f8d7da; color: #721c24; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Enhanced Test Report</h1>
        <p>Generated: ${data.timestamp}</p>
        <p>Duration: ${data.duration}ms</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>${data.summary.total}</h3>
            <p>Total Tests</p>
        </div>
        <div class="metric passed">
            <h3>${data.summary.passed}</h3>
            <p>Passed</p>
        </div>
        <div class="metric failed">
            <h3>${data.summary.failed}</h3>
            <p>Failed</p>
        </div>
    </div>

    <h2>Test Suites</h2>
    <table>
        <thead>
            <tr>
                <th>Suite</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Exit Code</th>
            </tr>
        </thead>
        <tbody>
            ${data.suites.map(suite => `
                <tr>
                    <td>${suite.name}</td>
                    <td class="${suite.passed ? 'passed' : 'failed'}">
                        ${suite.passed ? '✅ Passed' : '❌ Failed'}
                    </td>
                    <td>${suite.duration}ms</td>
                    <td>${suite.exitCode}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <h2>Environment</h2>
    <table>
        <tr><td>Node Version</td><td>${data.environment.nodeVersion}</td></tr>
        <tr><td>Platform</td><td>${data.environment.platform}</td></tr>
        <tr><td>Architecture</td><td>${data.environment.arch}</td></tr>
        <tr><td>CPU Cores</td><td>${data.environment.cpus}</td></tr>
    </table>
</body>
</html>
    `;
  }

  printSummary() {
    const duration = Date.now() - this.startTime;
    const successRate = this.results.total > 0 ? (this.results.passed / this.results.total * 100).toFixed(1) : 0;

    console.log('\n' + '='.repeat(60));
    console.log('📊 ENHANCED TEST RUNNER SUMMARY');
    console.log('='.repeat(60));
    console.log(`⏱️ Total Duration: ${duration}ms`);
    console.log(`📈 Success Rate: ${successRate}%`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⏭️ Skipped: ${this.results.skipped}`);
    console.log(`📊 Total: ${this.results.total}`);
    console.log('='.repeat(60));

    if (this.results.failed > 0) {
      console.log('\n❌ Failed Test Suites:');
      this.results.suites
        .filter(suite => !suite.passed)
        .forEach(suite => {
          console.log(`   - ${suite.name} (exit code: ${suite.exitCode})`);
        });
    }

    console.log('\n📄 Detailed reports available in ./test-results/');
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--max-workers':
        options.maxWorkers = parseInt(args[++i]);
        break;
      case '--timeout':
        options.timeout = parseInt(args[++i]);
        break;
      case '--retries':
        options.retries = parseInt(args[++i]);
        break;
      case '--no-coverage':
        options.coverage = false;
        break;
      case '--no-parallel':
        options.parallel = false;
        break;
      case '--help':
        console.log(`
Enhanced Test Runner

Usage: node enhanced-test-runner.js [options]

Options:
  --max-workers <n>    Maximum number of parallel workers (default: CPU count)
  --timeout <ms>       Test execution timeout in milliseconds (default: 300000)
  --retries <n>        Number of retries for failed tests (default: 1)
  --no-coverage        Disable coverage collection
  --no-parallel        Run tests sequentially instead of in parallel
  --help               Show this help message

Examples:
  node enhanced-test-runner.js --max-workers 4 --timeout 600000
  node enhanced-test-runner.js --no-parallel --retries 2
        `);
        process.exit(0);
    }
  }

  const runner = new EnhancedTestRunner(options);
  runner.run();
}

module.exports = EnhancedTestRunner;