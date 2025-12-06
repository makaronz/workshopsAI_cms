#!/usr/bin/env node

/**
 * Full Railway Deployment Validation Script
 * Comprehensive validation orchestrator for Railway deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class RailwayValidationOrchestrator {
  constructor() {
    this.projectRoot = process.cwd();
    this.results = {
      tests: {},
      validation: null,
      coverage: null,
      timestamp: new Date().toISOString(),
      success: false
    };
  }

  async run() {
    console.log('🚀 Starting Railway Deployment Validation Suite');
    console.log('='.repeat(50));

    try {
      await this.validatePrerequisites();
      await this.runDeploymentTests();
      await this.runRailwayValidation();
      await this.generateCoverageReport();
      await this.generateSummaryReport();

      console.log('\n✅ Railway Deployment Validation Completed Successfully!');
      console.log('📊 Detailed reports available in ./logs/');

    } catch (error) {
      console.error('\n❌ Railway Deployment Validation Failed:', error.message);
      process.exit(1);
    }
  }

  async validatePrerequisites() {
    console.log('🔍 Validating prerequisites...');

    const checks = [
      {
        name: 'Node.js version',
        check: () => process.version && process.version.startsWith('v1[689]'),
        error: 'Node.js 18+ required'
      },
      {
        name: 'Docker daemon',
        check: () => {
          try {
            execSync('docker version', { stdio: 'ignore' });
            return true;
          } catch {
            return false;
          }
        },
        error: 'Docker daemon must be running'
      },
      {
        name: 'Package.json exists',
        check: () => fs.existsSync('package.json'),
        error: 'package.json not found'
      },
      {
        name: 'Dockerfile exists',
        check: () => fs.existsSync('Dockerfile'),
        error: 'Dockerfile not found'
      }
    ];

    for (const check of checks) {
      if (!check.check()) {
        throw new Error(`Prerequisite check failed: ${check.name} - ${check.error}`);
      }
      console.log(`  ✅ ${check.name}`);
    }

    console.log('  ✅ All prerequisites validated\n');
  }

  async runDeploymentTests() {
    console.log('🧪 Running deployment tests...');

    try {
      console.log('  📋 Running Jest deployment tests...');
      execSync('npm run test:deployment', {
        stdio: 'pipe',
        cwd: this.projectRoot
      });

      console.log('  ✅ Deployment tests passed');
      this.results.tests.deployment = { status: 'passed', duration: 0 };

    } catch (error) {
      console.log('  ❌ Deployment tests failed');
      this.results.tests.deployment = {
        status: 'failed',
        error: error.message,
        duration: 0
      };
      throw error;
    }
  }

  async runRailwayValidation() {
    console.log('🔧 Running Railway validation...');

    try {
      console.log('  📋 Executing Railway validation script...');
      const output = execSync('./scripts/deployment/validate-railway-deployment.sh', {
        stdio: 'pipe',
        cwd: this.projectRoot
      });

      console.log('  ✅ Railway validation passed');
      this.results.validation = { status: 'passed', output: output.toString() };

    } catch (error) {
      console.log('  ❌ Railway validation failed');
      this.results.validation = {
        status: 'failed',
        error: error.message,
        output: error.stdout?.toString() || ''
      };
      throw error;
    }
  }

  async generateCoverageReport() {
    console.log('📊 Generating coverage report...');

    try {
      console.log('  📋 Running tests with coverage...');
      execSync('npm run test:deployment:coverage', {
        stdio: 'pipe',
        cwd: this.projectRoot
      });

      // Check if coverage report was generated
      const coverageDir = path.join(this.projectRoot, 'coverage/deployment');
      if (fs.existsSync(coverageDir)) {
        console.log('  ✅ Coverage report generated');
        this.results.coverage = {
          status: 'generated',
          directory: coverageDir
        };
      } else {
        throw new Error('Coverage report not generated');
      }

    } catch (error) {
      console.log('  ⚠️  Coverage report generation failed');
      this.results.coverage = {
        status: 'failed',
        error: error.message
      };
      // Don't fail the entire validation for coverage issues
    }
  }

  async generateSummaryReport() {
    console.log('📝 Generating summary report...');

    const summaryData = {
      timestamp: this.results.timestamp,
      project: 'workshopsAI CMS',
      version: this.getPackageVersion(),
      environment: process.env.NODE_ENV || 'development',
      results: this.results,
      railway: {
        readiness: this.calculateReadinessScore(),
        recommendations: this.getRecommendations(),
        nextSteps: this.getNextSteps()
      }
    };

    // Ensure logs directory exists
    const logsDir = path.join(this.projectRoot, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Write summary report
    const summaryPath = path.join(logsDir, 'railway-validation-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));

    // Write human-readable report
    const reportPath = path.join(logsDir, 'railway-validation-report.md');
    const reportContent = this.generateMarkdownReport(summaryData);
    fs.writeFileSync(reportPath, reportContent);

    console.log(`  ✅ Summary report generated:`);
    console.log(`     📄 JSON: ${summaryPath}`);
    console.log(`     📋 Markdown: ${reportPath}`);

    this.results.success = true;
  }

  getPackageVersion() {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      return packageJson.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  calculateReadinessScore() {
    let score = 0;
    let maxScore = 100;

    // Tests passing (40 points)
    if (this.results.tests.deployment?.status === 'passed') {
      score += 40;
    }

    // Validation passing (40 points)
    if (this.results.validation?.status === 'passed') {
      score += 40;
    }

    // Coverage generated (20 points)
    if (this.results.coverage?.status === 'generated') {
      score += 20;
    }

    return Math.round(score);
  }

  getRecommendations() {
    const recommendations = [];

    if (this.results.tests.deployment?.status !== 'passed') {
      recommendations.push('Fix failing deployment tests before proceeding with Railway deployment');
    }

    if (this.results.validation?.status !== 'passed') {
      recommendations.push('Address Railway validation issues to ensure deployment readiness');
    }

    if (this.results.coverage?.status !== 'generated') {
      recommendations.push('Ensure test coverage meets minimum requirements for production deployment');
    }

    // Add general recommendations
    recommendations.push('Review Railway environment variables configuration');
    recommendations.push('Test deployment in staging environment first');
    recommendations.push('Set up monitoring and alerting for production');
    recommendations.push('Document rollback procedures');

    return recommendations;
  }

  getNextSteps() {
    const readinessScore = this.calculateReadinessScore();

    if (readinessScore >= 90) {
      return [
        '🚀 Ready for Railway deployment',
        '📋 Push code to repository',
        '⚙️  Configure Railway environment variables',
        '🔗 Connect repository to Railway',
        '🚢 Deploy to Railway'
      ];
    } else if (readinessScore >= 70) {
      return [
        '⚠️  Nearly ready for Railway deployment',
        '🔧 Fix identified issues',
        '🧪 Re-run validation after fixes',
        '🚀 Proceed with Railway deployment'
      ];
    } else {
      return [
        '❌ Not ready for Railway deployment',
        '🐛 Fix critical deployment issues',
        '🧪 Re-run validation suite',
        '📋 Review documentation for troubleshooting',
        '🚀 Retry validation after fixes'
      ];
    }
  }

  generateMarkdownReport(data) {
    const { results, railway } = data;
    const readinessScore = railway.readinessScore;

    return `# Railway Deployment Validation Report

**Generated:** ${data.timestamp}
**Project:** ${data.project} v${data.version}
**Environment:** ${data.environment}
**Readiness Score:** ${readinessScore}/100

## Summary Status

${readinessScore >= 90 ? '✅' : readinessScore >= 70 ? '⚠️' : '❌'} **Railway Deployment Readiness:** ${
  readinessScore >= 90 ? 'EXCELLENT - Ready for deployment' :
  readinessScore >= 70 ? 'GOOD - Nearly ready' :
  'NOT READY - Issues to resolve'
}

## Test Results

### Deployment Tests
${results.tests.deployment?.status === 'passed' ? '✅ Passed' : '❌ Failed'}

${results.tests.deployment?.error ? `\n\`\`\`\nError: ${results.tests.deployment.error}\n\`\`\`` : ''}

### Railway Validation
${results.validation?.status === 'passed' ? '✅ Passed' : '❌ Failed'}

${results.validation?.error ? `\n\`\`\`\nError: ${results.validation.error}\n\`\`\`` : ''}

### Coverage Report
${results.coverage?.status === 'generated' ? '✅ Generated' : results.coverage?.status === 'failed' ? '❌ Failed' : '⚠️ Skipped'}

${results.coverage?.directory ? `\n📁 Coverage directory: ${results.coverage.directory}` : ''}

## Recommendations

${railway.recommendations.map(rec => `- ${rec}`).join('\n')}

## Next Steps

${railway.nextSteps.map(step => `- ${step}`).join('\n')}

## Additional Information

- **Detailed JSON Report:** \`./logs/railway-validation-summary.json\`
- **Coverage Report:** \`./coverage/deployment/\`
- **Validation Log:** \`./logs/railway-validation.log\`
- **Railway Documentation:** See \`docs/RAILWAY_DEPLOYMENT_TESTING.md\`

---

*Report generated by Railway Deployment Validation Orchestrator*
`;
  }
}

// Run the orchestrator if called directly
if (require.main === module) {
  const orchestrator = new RailwayValidationOrchestrator();
  orchestrator.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = RailwayValidationOrchestrator;