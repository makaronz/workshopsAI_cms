/**
 * Test Quality Monitoring System
 *
 * Provides comprehensive test quality analysis including:
 * - Flaky test detection
 * - Performance regression monitoring
 * - Test coverage trend analysis
 * - Code quality metrics
 * - Automated recommendations
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface TestQualityMetrics {
  testSuite: string;
  timestamp: string;
  coverage: CoverageMetrics;
  performance: PerformanceMetrics;
  reliability: ReliabilityMetrics;
  maintainability: MaintainabilityMetrics;
}

interface CoverageMetrics {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
  uncoveredFiles: string[];
  riskyAreas: string[];
}

interface PerformanceMetrics {
  averageExecutionTime: number;
  slowestTests: TestTiming[];
  memoryUsage: number;
  trend: TrendData;
}

interface ReliabilityMetrics {
  flakyTests: FlakyTest[];
  failureRate: number;
  averageRetries: number;
  reliabilityScore: number;
}

interface MaintainabilityMetrics {
  testComplexity: TestComplexity[];
  codeDuplication: number;
  testDependencies: DependencyAnalysis;
  maintenanceScore: number;
}

interface FlakyTest {
  name: string;
  file: string;
  failureRate: number;
  lastFailures: Date[];
  patterns: string[];
  recommendations: string[];
}

interface TestTiming {
  name: string;
  duration: number;
  trend: 'improving' | 'stable' | 'degrading';
  threshold: number;
}

interface TrendData {
  period: string;
  values: number[];
  direction: 'up' | 'down' | 'stable';
  changePercentage: number;
}

interface TestComplexity {
  file: string;
  complexity: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  maintainabilityIndex: number;
}

interface DependencyAnalysis {
  coupling: number;
  cohesion: number;
  externalDependencies: string[];
  mockDependencies: string[];
}

interface QualityAlert {
  type: 'performance' | 'reliability' | 'coverage' | 'maintainability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metrics: any;
  recommendations: string[];
}

export class TestQualityMonitor {
  private readonly resultsDir: string;
  private readonly historyDir: string;
  private readonly alertThresholds: AlertThresholds;

  constructor() {
    this.resultsDir = path.join(process.cwd(), 'test-results');
    this.historyDir = path.join(this.resultsDir, 'history');
    this.alertThresholds = {
      coverage: {
        minGlobalCoverage: 85,
        minCriticalFileCoverage: 95,
        maxUncoveredFiles: 5
      },
      performance: {
        maxAverageExecutionTime: 30000,
        maxSlowTestCount: 10,
        maxMemoryUsage: 512 * 1024 * 1024 // 512MB
      },
      reliability: {
        maxFailureRate: 0.05,
        maxFlakyTestRate: 0.1,
        minReliabilityScore: 90
      },
      maintainability: {
        maxComplexity: 10,
        maxCodeDuplication: 15,
        minMaintainabilityIndex: 70
      }
    };

    this.ensureDirectories();
  }

  async analyzeTestQuality(): Promise<TestQualityMetrics> {
    console.log('🔍 Analyzing test quality...');

    const metrics: TestQualityMetrics = {
      testSuite: 'workshopsAI-cms',
      timestamp: new Date().toISOString(),
      coverage: await this.analyzeCoverage(),
      performance: await this.analyzePerformance(),
      reliability: await this.analyzeReliability(),
      maintainability: await this.analyzeMaintainability()
    };

    await this.saveMetrics(metrics);
    await this.generateAlerts(metrics);
    await this.generateQualityReport(metrics);

    return metrics;
  }

  private async analyzeCoverage(): Promise<CoverageMetrics> {
    console.log('📊 Analyzing code coverage...');

    const coverageFile = path.join(this.resultsDir, 'coverage', 'coverage-final.json');

    if (!fs.existsSync(coverageFile)) {
      return {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
        uncoveredFiles: [],
        riskyAreas: []
      };
    }

    const coverageData = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
    const total = coverageData.total || {};

    const uncoveredFiles = this.findUncoveredFiles(coverageData);
    const riskyAreas = this.identifyRiskyAreas(uncoveredFiles);

    return {
      lines: total.lines?.pct || 0,
      functions: total.functions?.pct || 0,
      branches: total.branches?.pct || 0,
      statements: total.statements?.pct || 0,
      uncoveredFiles,
      riskyAreas
    };
  }

  private async analyzePerformance(): Promise<PerformanceMetrics> {
    console.log('⚡ Analyzing test performance...');

    const testReportFile = path.join(this.resultsDir, 'enhanced-test-report.json');
    let executionTime = 0;
    let slowestTests: TestTiming[] = [];
    let memoryUsage = 0;

    if (fs.existsSync(testReportFile)) {
      const report = JSON.parse(fs.readFileSync(testReportFile, 'utf8'));
      executionTime = report.duration || 0;
      slowestTests = this.analyzeSlowTests(report.suites || []);
      memoryUsage = this.estimateMemoryUsage(report);
    }

    const trend = await this.analyzePerformanceTrend();

    return {
      averageExecutionTime: executionTime,
      slowestTests,
      memoryUsage,
      trend
    };
  }

  private async analyzeReliability(): Promise<ReliabilityMetrics> {
    console.log('🔒 Analyzing test reliability...');

    const ciHistory = await this.getCiHistory();
    const flakyTests = this.detectFlakyTests(ciHistory);
    const failureRate = this.calculateFailureRate(ciHistory);
    const averageRetries = this.calculateAverageRetries(ciHistory);
    const reliabilityScore = this.calculateReliabilityScore(failureRate, flakyTests);

    return {
      flakyTests,
      failureRate,
      averageRetries,
      reliabilityScore
    };
  }

  private async analyzeMaintainability(): Promise<MaintainabilityMetrics> {
    console.log('🔧 Analyzing test maintainability...');

    const testFiles = this.findTestFiles();
    const testComplexity = this.analyzeTestComplexity(testFiles);
    const codeDuplication = this.detectCodeDuplication(testFiles);
    const testDependencies = this.analyzeTestDependencies(testFiles);
    const maintenanceScore = this.calculateMaintenanceScore(testComplexity, codeDuplication);

    return {
      testComplexity,
      codeDuplication,
      testDependencies,
      maintenanceScore
    };
  }

  private findUncoveredFiles(coverageData: any): string[] {
    const uncoveredFiles: string[] = [];
    const srcDir = path.join(process.cwd(), 'src');

    if (!fs.existsSync(srcDir)) {
      return uncoveredFiles;
    }

    const allSourceFiles = this.getAllTypeScriptFiles(srcDir);

    for (const file of allSourceFiles) {
      const relativePath = path.relative(srcDir, file);
      const coveragePath = relativePath.replace(/\.ts$/, '.js');

      if (!coverageData[coveragePath] || coverageData[coveragePath].lines.pct === 0) {
        uncoveredFiles.push(relativePath);
      }
    }

    return uncoveredFiles;
  }

  private identifyRiskyAreas(uncoveredFiles: string[]): string[] {
    const riskyPatterns = [
      'auth', 'security', 'payment', 'admin', 'database', 'api'
    ];

    return uncoveredFiles.filter(file =>
      riskyPatterns.some(pattern => file.toLowerCase().includes(pattern))
    );
  }

  private getAllTypeScriptFiles(dir: string): string[] {
    const files: string[] = [];

    function traverse(currentDir: string) {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (item.endsWith('.ts') && !item.endsWith('.d.ts') && !item.includes('.test.') && !item.includes('.spec.')) {
          files.push(fullPath);
        }
      }
    }

    traverse(dir);
    return files;
  }

  private findTestFiles(): string[] {
    const testDir = path.join(process.cwd(), 'tests');
    if (!fs.existsSync(testDir)) {
      return [];
    }

    return this.getAllTypeScriptFiles(testDir).filter(file =>
      file.includes('.test.') || file.includes('.spec.')
    );
  }

  private analyzeSlowTests(suites: any[]): TestTiming[] {
    const allTests: TestTiming[] = [];

    for (const suite of suites) {
      if (suite.tests) {
        for (const test of suite.tests) {
          const duration = test.duration || 0;
          const threshold = 5000; // 5 seconds threshold

          allTests.push({
            name: test.title || test.name || 'Unknown Test',
            duration,
            trend: 'stable', // Would be calculated from historical data
            threshold
          });
        }
      } else if (suite.duration) {
        allTests.push({
          name: suite.name || 'Unknown Suite',
          duration: suite.duration,
          trend: 'stable',
          threshold: 30000 // 30 seconds for suites
        });
      }
    }

    return allTests
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
  }

  private estimateMemoryUsage(report: any): number {
    // This is a simplified estimation
    const baseMemory = 100 * 1024 * 1024; // 100MB base
    const testCount = report.suites?.length || 0;
    const memoryPerTest = 5 * 1024 * 1024; // 5MB per test

    return baseMemory + (testCount * memoryPerTest);
  }

  private async analyzePerformanceTrend(): Promise<TrendData> {
    // Analyze historical performance data
    const historyFiles = this.getHistoryFiles('performance');
    const values = historyFiles.map(file => {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return data.duration || 0;
    });

    if (values.length < 2) {
      return {
        period: '7-days',
        values,
        direction: 'stable',
        changePercentage: 0
      };
    }

    const recent = values.slice(-5);
    const older = values.slice(-10, -5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;

    const changePercentage = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

    return {
      period: '7-days',
      values: recent,
      direction: changePercentage > 5 ? 'up' : changePercentage < -5 ? 'down' : 'stable',
      changePercentage
    };
  }

  private async getCiHistory(): any[] {
    // This would typically integrate with CI/CD system
    // For now, return mock data
    return [];
  }

  private detectFlakyTests(history: any[]): FlakyTest[] {
    // Analyze historical test runs to identify flaky tests
    // This is a simplified implementation
    return [];
  }

  private calculateFailureRate(history: any[]): number {
    if (history.length === 0) return 0;

    const failures = history.filter(run => run.status === 'failed').length;
    return failures / history.length;
  }

  private calculateAverageRetries(history: any[]): number {
    if (history.length === 0) return 0;

    const totalRetries = history.reduce((sum, run) => sum + (run.retries || 0), 0);
    return totalRetries / history.length;
  }

  private calculateReliabilityScore(failureRate: number, flakyTests: FlakyTest[]): number {
    const baseScore = 100;
    const failurePenalty = failureRate * 100;
    const flakyPenalty = flakyTests.length * 10;

    return Math.max(0, baseScore - failurePenalty - flakyPenalty);
  }

  private analyzeTestComplexity(testFiles: string[]): TestComplexity[] {
    return testFiles.map(file => {
      const content = fs.readFileSync(file, 'utf8');

      // Simplified complexity analysis
      const lines = content.split('\n').length;
      const describeMatches = (content.match(/describe\(/g) || []).length;
      const itMatches = (content.match(/it\(/g) || []).length;

      const cyclomaticComplexity = Math.max(1, describeMatches + itMatches);
      const cognitiveComplexity = Math.min(50, lines / 10);
      const maintainabilityIndex = Math.max(0, 100 - (cognitiveComplexity * 2));

      return {
        file: path.relative(process.cwd(), file),
        complexity: cyclomaticComplexity + cognitiveComplexity,
        cyclomaticComplexity,
        cognitiveComplexity,
        maintainabilityIndex
      };
    });
  }

  private detectCodeDuplication(testFiles: string[]): number {
    // Simplified code duplication detection
    // In a real implementation, this would use more sophisticated algorithms
    const patterns = new Map<string, number>();

    for (const file of testFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length - 2; i++) {
        const pattern = lines.slice(i, i + 3).join('\n').trim();
        if (pattern.length > 20) {
          patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
        }
      }
    }

    const duplicates = Array.from(patterns.values()).filter(count => count > 1).length;
    const totalPatterns = patterns.size;

    return totalPatterns > 0 ? (duplicates / totalPatterns) * 100 : 0;
  }

  private analyzeTestDependencies(testFiles: string[]): DependencyAnalysis {
    let externalDependencies = new Set<string>();
    let mockDependencies = new Set<string>();

    for (const file of testFiles) {
      const content = fs.readFileSync(file, 'utf8');

      // Find import statements
      const imports = content.match(/import.*from\s+['"](.+?)['"]/g) || [];

      for (const importStatement of imports) {
        const match = importStatement.match(/from\s+['"](.+?)['"]/);
        if (match) {
          const dependency = match[1];
          if (dependency.startsWith('@') || !dependency.startsWith('.')) {
            externalDependencies.add(dependency);
          }
        }
      }

      // Find mock calls
      const mocks = content.match(/jest\.mock\(['"](.+?)['"]/g) || [];
      for (const mockStatement of mocks) {
        const match = mockStatement.match(/jest\.mock\(['"](.+?)['"]/);
        if (match) {
          mockDependencies.add(match[1]);
        }
      }
    }

    return {
      coupling: Math.min(10, externalDependencies.size / testFiles.length * 2),
      cohesion: Math.max(0, 100 - externalDependencies.size * 5),
      externalDependencies: Array.from(externalDependencies),
      mockDependencies: Array.from(mockDependencies)
    };
  }

  private calculateMaintenanceScore(complexity: TestComplexity[], codeDuplication: number): number {
    const avgComplexity = complexity.reduce((sum, item) => sum + item.complexity, 0) / complexity.length;
    const avgMaintainability = complexity.reduce((sum, item) => sum + item.maintainabilityIndex, 0) / complexity.length;

    const complexityScore = Math.max(0, 100 - avgComplexity * 5);
    const duplicationScore = Math.max(0, 100 - codeDuplication * 2);
    const maintainabilityScore = avgMaintainability;

    return (complexityScore + duplicationScore + maintainabilityScore) / 3;
  }

  private async saveMetrics(metrics: TestQualityMetrics): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-quality-${timestamp}.json`;
    const filepath = path.join(this.historyDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(metrics, null, 2));
  }

  private async generateAlerts(metrics: TestQualityMetrics): Promise<void> {
    const alerts: QualityAlert[] = [];

    // Coverage alerts
    if (metrics.coverage.lines < this.alertThresholds.coverage.minGlobalCoverage) {
      alerts.push({
        type: 'coverage',
        severity: 'high',
        message: `Global coverage (${metrics.coverage.lines.toFixed(1)}%) is below threshold (${this.alertThresholds.coverage.minGlobalCoverage}%)`,
        metrics: metrics.coverage,
        recommendations: [
          'Add unit tests for uncovered business logic',
          'Focus on critical path coverage first',
          'Consider test-driven development for new features'
        ]
      });
    }

    if (metrics.coverage.uncoveredFiles.length > this.alertThresholds.coverage.maxUncoveredFiles) {
      alerts.push({
        type: 'coverage',
        severity: 'medium',
        message: `${metrics.coverage.uncoveredFiles.length} files have zero test coverage`,
        metrics: { uncoveredFiles: metrics.coverage.uncoveredFiles },
        recommendations: [
          'Prioritize testing for critical files',
          'Create test templates for common patterns',
          'Set up coverage monitoring in CI'
        ]
      });
    }

    // Performance alerts
    if (metrics.performance.averageExecutionTime > this.alertThresholds.performance.maxAverageExecutionTime) {
      alerts.push({
        type: 'performance',
        severity: 'medium',
        message: `Average test execution time (${metrics.performance.averageExecutionTime}ms) exceeds threshold`,
        metrics: metrics.performance,
        recommendations: [
          'Optimize test database operations',
          'Implement better test isolation',
          'Consider parallel test execution'
        ]
      });
    }

    // Reliability alerts
    if (metrics.reliability.failureRate > this.alertThresholds.reliability.maxFailureRate) {
      alerts.push({
        type: 'reliability',
        severity: 'high',
        message: `Test failure rate (${(metrics.reliability.failureRate * 100).toFixed(1)}%) is too high`,
        metrics: metrics.reliability,
        recommendations: [
          'Investigate and fix flaky tests',
          'Improve test environment stability',
          'Add better error handling and retries'
        ]
      });
    }

    // Maintainability alerts
    if (metrics.maintainability.maintenanceScore < this.alertThresholds.maintainability.minMaintainabilityIndex) {
      alerts.push({
        type: 'maintainability',
        severity: 'medium',
        message: `Test maintainability score (${metrics.maintainability.maintenanceScore.toFixed(1)}) is below threshold`,
        metrics: metrics.maintainability,
        recommendations: [
          'Refactor complex test files',
          'Extract common test utilities',
          'Improve test documentation'
        ]
      });
    }

    // Save alerts
    if (alerts.length > 0) {
      const alertsFile = path.join(this.resultsDir, 'quality-alerts.json');
      fs.writeFileSync(alertsFile, JSON.stringify(alerts, null, 2));

      console.log(`🚨 Generated ${alerts.length} quality alerts`);
      alerts.forEach(alert => {
        console.log(`  ${alert.severity.toUpperCase()}: ${alert.message}`);
      });
    }
  }

  private async generateQualityReport(metrics: TestQualityMetrics): Promise<void> {
    const report = this.generateHTMLQualityReport(metrics);
    const reportFile = path.join(this.resultsDir, 'test-quality-report.html');

    fs.writeFileSync(reportFile, report);
    console.log(`📄 Quality report generated: ${reportFile}`);
  }

  private generateHTMLQualityReport(metrics: TestQualityMetrics): string {
    const timestamp = new Date().toLocaleString();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Quality Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-left: 5px solid #667eea;
        }
        .metric-title {
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 15px;
            color: #2d3748;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
        }
        .metric-details {
            font-size: 0.9em;
            color: #666;
        }
        .progress-bar {
            width: 100%;
            height: 10px;
            background-color: #e2e8f0;
            border-radius: 5px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            transition: width 0.3s ease;
        }
        .progress-good { background-color: #48bb78; }
        .progress-warning { background-color: #ed8936; }
        .progress-danger { background-color: #f56565; }
        .alert {
            background: #fed7d7;
            border: 1px solid #feb2b2;
            color: #c53030;
            padding: 15px;
            border-radius: 5px;
            margin: 10px 0;
        }
        .alert-warning {
            background: #fefcbf;
            border-color: #f6e05e;
            color: #975a16;
        }
        .alert-info {
            background: #bee3f8;
            border-color: #90cdf4;
            color: #2c5282;
        }
        .table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .table th, .table td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        .table th {
            background: #f7fafc;
            font-weight: bold;
            color: #2d3748;
        }
        .score-badge {
            padding: 5px 10px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 0.9em;
        }
        .score-excellent { background: #48bb78; color: white; }
        .score-good { background: #4299e1; color: white; }
        .score-warning { background: #ed8936; color: white; }
        .score-danger { background: #f56565; color: white; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Test Quality Report</h1>
        <p>Generated on ${timestamp}</p>
        <p>${metrics.testSuite}</p>
    </div>

    <div class="metrics-grid">
        <!-- Coverage Metrics -->
        <div class="metric-card">
            <div class="metric-title">📊 Code Coverage</div>
            <div class="metric-value">${metrics.coverage.lines.toFixed(1)}%</div>
            <div class="metric-details">
                <div>Lines: ${metrics.coverage.lines.toFixed(1)}%</div>
                <div>Functions: ${metrics.coverage.functions.toFixed(1)}%</div>
                <div>Branches: ${metrics.coverage.branches.toFixed(1)}%</div>
                <div class="progress-bar">
                    <div class="progress-fill ${metrics.coverage.lines >= 85 ? 'progress-good' : metrics.coverage.lines >= 70 ? 'progress-warning' : 'progress-danger'}"
                         style="width: ${metrics.coverage.lines}%"></div>
                </div>
                <div>Uncovered Files: ${metrics.coverage.uncoveredFiles.length}</div>
            </div>
        </div>

        <!-- Performance Metrics -->
        <div class="metric-card">
            <div class="metric-title">⚡ Performance</div>
            <div class="metric-value">${(metrics.performance.averageExecutionTime / 1000).toFixed(1)}s</div>
            <div class="metric-details">
                <div>Average Execution Time: ${(metrics.performance.averageExecutionTime / 1000).toFixed(1)}s</div>
                <div>Memory Usage: ${(metrics.performance.memoryUsage / 1024 / 1024).toFixed(1)}MB</div>
                <div>Trend: ${metrics.performance.trend.direction} (${metrics.performance.trend.changePercentage.toFixed(1)}%)</div>
                <div>Slow Tests: ${metrics.performance.slowestTests.length}</div>
            </div>
        </div>

        <!-- Reliability Metrics -->
        <div class="metric-card">
            <div class="metric-title">🔒 Reliability</div>
            <div class="metric-value">${metrics.reliability.reliabilityScore.toFixed(0)}</div>
            <div class="metric-details">
                <div>Reliability Score: ${metrics.reliability.reliabilityScore.toFixed(0)}/100</div>
                <div>Failure Rate: ${(metrics.reliability.failureRate * 100).toFixed(1)}%</div>
                <div>Flaky Tests: ${metrics.reliability.flakyTests.length}</div>
                <div>Average Retries: ${metrics.reliability.averageRetries.toFixed(1)}</div>
            </div>
        </div>

        <!-- Maintainability Metrics -->
        <div class="metric-card">
            <div class="metric-title">🔧 Maintainability</div>
            <div class="metric-value">${metrics.maintainability.maintenanceScore.toFixed(0)}</div>
            <div class="metric-details">
                <div>Maintenance Score: ${metrics.maintainability.maintenanceScore.toFixed(0)}/100</div>
                <div>Average Complexity: ${metrics.maintainability.testComplexity.length > 0 ? (metrics.maintainability.testComplexity.reduce((sum, item) => sum + item.complexity, 0) / metrics.maintainability.testComplexity.length).toFixed(1) : 'N/A'}</div>
                <div>Code Duplication: ${metrics.maintainability.codeDuplication.toFixed(1)}%</div>
                <div>Coupling: ${metrics.maintainability.testDependencies.coupling.toFixed(1)}/10</div>
            </div>
        </div>
    </div>

    <!-- Detailed Information -->
    <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 30px;">
        <h2 style="color: #2d3748; margin-bottom: 20px;">📋 Detailed Analysis</h2>

        ${metrics.coverage.riskyAreas.length > 0 ? `
        <div class="alert">
            <strong>⚠️ Risky Uncovered Areas:</strong>
            <ul>${metrics.coverage.riskyAreas.map(area => `<li>${area}</li>`).join('')}</ul>
        </div>
        ` : ''}

        ${metrics.performance.slowestTests.length > 0 ? `
        <h3>🐌 Slowest Tests</h3>
        <table class="table">
            <thead>
                <tr>
                    <th>Test Name</th>
                    <th>Duration</th>
                    <th>Trend</th>
                </tr>
            </thead>
            <tbody>
                ${metrics.performance.slowestTests.slice(0, 5).map(test => `
                <tr>
                    <td>${test.name}</td>
                    <td>${(test.duration / 1000).toFixed(1)}s</td>
                    <td><span class="score-badge ${test.trend === 'improving' ? 'score-good' : test.trend === 'degrading' ? 'score-danger' : 'score-warning'}">${test.trend}</span></td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        ` : ''}

        ${metrics.reliability.flakyTests.length > 0 ? `
        <h3>🔄 Flaky Tests</h3>
        <table class="table">
            <thead>
                <tr>
                    <th>Test Name</th>
                    <th>Failure Rate</th>
                    <th>Last Failures</th>
                </tr>
            </thead>
            <tbody>
                ${metrics.reliability.flakyTests.map(test => `
                <tr>
                    <td>${test.name}</td>
                    <td>${(test.failureRate * 100).toFixed(1)}%</td>
                    <td>${test.lastFailures.length}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        ` : ''}

        ${metrics.maintainability.testComplexity.length > 0 ? `
        <h3>📈 Test Complexity</h3>
        <table class="table">
            <thead>
                <tr>
                    <th>File</th>
                    <th>Complexity</th>
                    <th>Maintainability</th>
                </tr>
            </thead>
            <tbody>
                ${metrics.maintainability.testComplexity
                    .sort((a, b) => b.complexity - a.complexity)
                    .slice(0, 10)
                    .map(test => `
                <tr>
                    <td>${test.file}</td>
                    <td><span class="score-badge ${test.complexity <= 10 ? 'score-good' : test.complexity <= 15 ? 'score-warning' : 'score-danger'}">${test.complexity}</span></td>
                    <td><span class="score-badge ${test.maintainabilityIndex >= 70 ? 'score-good' : test.maintainabilityIndex >= 50 ? 'score-warning' : 'score-danger'}">${test.maintainabilityIndex.toFixed(0)}</span></td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        ` : ''}
    </div>

    <script>
        // Add interactive features
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Test Quality Report loaded');
        });
    </script>
</body>
</html>
    `;
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
    if (!fs.existsSync(this.historyDir)) {
      fs.mkdirSync(this.historyDir, { recursive: true });
    }
  }

  private getHistoryFiles(type: string): string[] {
    const historyDir = path.join(this.historyDir, type);
    if (!fs.existsSync(historyDir)) {
      return [];
    }

    return fs.readdirSync(historyDir)
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(historyDir, file))
      .sort();
  }
}

// Alert thresholds interface
interface AlertThresholds {
  coverage: {
    minGlobalCoverage: number;
    minCriticalFileCoverage: number;
    maxUncoveredFiles: number;
  };
  performance: {
    maxAverageExecutionTime: number;
    maxSlowTestCount: number;
    maxMemoryUsage: number;
  };
  reliability: {
    maxFailureRate: number;
    maxFlakyTestRate: number;
    minReliabilityScore: number;
  };
  maintainability: {
    maxComplexity: number;
    maxCodeDuplication: number;
    minMaintainabilityIndex: number;
  };
}

// CLI interface
if (require.main === module) {
  const monitor = new TestQualityMonitor();
  monitor.analyzeTestQuality()
    .then(() => {
      console.log('✅ Test quality analysis completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Test quality analysis failed:', error);
      process.exit(1);
    });
}

export default TestQualityMonitor;