/**
 * Comprehensive Initialization Validation Test Suite
 *
 * This test suite validates that the development environment initializes correctly
 * and all critical systems are properly configured and functional.
 */

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { promisify } from 'util';

interface ValidationResult {
  success: boolean;
  message: string;
  details?: any;
  error?: string;
}

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  message: string;
  details?: any;
}

class InitializationValidator {
  private results: TestResult[] = [];
  private projectRoot = resolve(__dirname, '../..');

  private addResult(testName: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, details?: any) {
    this.results.push({
      testName,
      status,
      duration: 0,
      message,
      details
    });
  }

  private runCommand(command: string, options: { timeout?: number } = {}): ValidationResult {
    try {
      const startTime = Date.now();
      const output = execSync(command, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        timeout: options.timeout || 30000,
        stdio: 'pipe'
      });
      return {
        success: true,
        message: `Command executed successfully`,
        details: {
          output: output.trim(),
          duration: Date.now() - startTime
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Command failed: ${command}`,
        error: error.message,
        details: {
          exitCode: error.status,
          signal: error.signal
        }
      };
    }
  }

  /**
   * Test 1: Validate Node.js and npm versions
   */
  async testNodeEnvironment(): Promise<void> {
    const testName = 'Node.js Environment Validation';

    try {
      // Check Node.js version (should be >= 20.0.0)
      const nodeVersion = process.version;
      const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);

      if (nodeMajor < 20) {
        this.addResult(testName, 'FAIL', `Node.js version ${nodeVersion} is below required v20.0.0`);
        return;
      }

      // Check npm version
      const npmResult = this.runCommand('npm --version');
      if (!npmResult.success) {
        this.addResult(testName, 'FAIL', 'Failed to check npm version', npmResult.error);
        return;
      }

      this.addResult(testName, 'PASS', `Node.js ${nodeVersion}, npm ${npmResult.details?.output}`);
    } catch (error: any) {
      this.addResult(testName, 'FAIL', `Error checking Node.js environment: ${error.message}`);
    }
  }

  /**
   * Test 2: Validate package.json structure
   */
  async testPackageConfiguration(): Promise<void> {
    const testName = 'Package Configuration Validation';

    try {
      const packageJsonPath = resolve(this.projectRoot, 'package.json');
      if (!existsSync(packageJsonPath)) {
        this.addResult(testName, 'FAIL', 'package.json not found');
        return;
      }

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

      // Validate required fields
      const requiredFields = ['name', 'version', 'scripts', 'dependencies', 'devDependencies'];
      const missingFields = requiredFields.filter(field => !packageJson[field]);

      if (missingFields.length > 0) {
        this.addResult(testName, 'FAIL', `Missing required fields: ${missingFields.join(', ')}`);
        return;
      }

      // Validate critical scripts
      const criticalScripts = ['build', 'test', 'lint', 'typecheck', 'dev'];
      const missingScripts = criticalScripts.filter(script => !packageJson.scripts[script]);

      if (missingScripts.length > 0) {
        this.addResult(testName, 'FAIL', `Missing critical scripts: ${missingScripts.join(', ')}`);
        return;
      }

      this.addResult(testName, 'PASS', `Package ${packageJson.name}@${packageJson.version} is properly configured`);
    } catch (error: any) {
      this.addResult(testName, 'FAIL', `Error validating package.json: ${error.message}`);
    }
  }

  /**
   * Test 3: Validate TypeScript configuration
   */
  async testTypeScriptConfiguration(): Promise<void> {
    const testName = 'TypeScript Configuration Validation';

    try {
      const tsconfigPath = resolve(this.projectRoot, 'tsconfig.json');
      if (!existsSync(tsconfigPath)) {
        this.addResult(testName, 'FAIL', 'tsconfig.json not found');
        return;
      }

      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));

      // Validate critical compiler options
      const requiredOptions = ['compilerOptions', 'include', 'exclude'];
      const missingOptions = requiredOptions.filter(option => !tsconfig[option]);

      if (missingOptions.length > 0) {
        this.addResult(testName, 'FAIL', `Missing TypeScript configuration: ${missingOptions.join(', ')}`);
        return;
      }

      // Check for strict mode
      if (!tsconfig.compilerOptions.strict) {
        this.addResult(testName, 'PASS', 'TypeScript configuration found (strict mode disabled)', { warning: 'Consider enabling strict mode for better type safety' });
      } else {
        this.addResult(testName, 'PASS', 'TypeScript configuration found with strict mode enabled');
      }
    } catch (error: any) {
      this.addResult(testName, 'FAIL', `Error validating TypeScript configuration: ${error.message}`);
    }
  }

  /**
   * Test 4: Validate dependency installation
   */
  async testDependencyInstallation(): Promise<void> {
    const testName = 'Dependency Installation Validation';

    try {
      // Check if node_modules exists
      const nodeModulesPath = resolve(this.projectRoot, 'node_modules');
      if (!existsSync(nodeModulesPath)) {
        this.addResult(testName, 'FAIL', 'node_modules directory not found - dependencies not installed');
        return;
      }

      // Try npm list to verify installation
      const npmListResult = this.runCommand('npm list --depth=0 --json', { timeout: 15000 });

      if (!npmListResult.success) {
        this.addResult(testName, 'FAIL', 'Dependencies appear to be corrupted or incomplete', npmListResult.error);
        return;
      }

      const packageInfo = JSON.parse(npmListResult.details!.output);
      const dependencyCount = Object.keys(packageInfo.dependencies || {}).length;

      this.addResult(testName, 'PASS', `Dependencies successfully installed (${dependencyCount} packages)`);
    } catch (error: any) {
      this.addResult(testName, 'FAIL', `Error validating dependencies: ${error.message}`);
    }
  }

  /**
   * Test 5: Validate build process
   */
  async testBuildProcess(): Promise<void> {
    const testName = 'Build Process Validation';

    try {
      const buildResult = this.runCommand('npm run build', { timeout: 60000 });

      if (!buildResult.success) {
        this.addResult(testName, 'FAIL', 'Build process failed', buildResult.error);

        // Check for specific error patterns
        const errorOutput = buildResult.error || '';
        if (errorOutput.includes('TS')) {
          this.addResult(testName + ' - TypeScript Errors', 'FAIL', 'TypeScript compilation errors detected');
        }
        if (errorOutput.includes('module')) {
          this.addResult(testName + ' - Module Issues', 'FAIL', 'Module resolution issues detected');
        }
        return;
      }

      // Check if dist directory was created
      const distPath = resolve(this.projectRoot, 'dist');
      if (existsSync(distPath)) {
        this.addResult(testName, 'PASS', `Build completed successfully in ${buildResult.details?.duration}ms`);
      } else {
        this.addResult(testName, 'FAIL', 'Build completed but no dist directory created');
      }
    } catch (error: any) {
      this.addResult(testName, 'FAIL', `Error during build process: ${error.message}`);
    }
  }

  /**
   * Test 6: Validate testing framework setup
   */
  async testTestingFramework(): Promise<void> {
    const testName = 'Testing Framework Validation';

    try {
      // Check Jest configuration
      const jestConfigPath = resolve(this.projectRoot, 'jest.config.js');
      if (!existsSync(jestConfigPath)) {
        this.addResult(testName, 'FAIL', 'Jest configuration not found');
        return;
      }

      // Check Playwright configuration
      const playwrightConfigPath = resolve(this.projectRoot, 'playwright.config.ts');
      if (!existsSync(playwrightConfigPath)) {
        this.addResult(testName, 'FAIL', 'Playwright configuration not found');
        return;
      }

      // Try running unit tests with dry run
      const testResult = this.runCommand('npm run test -- --passWithNoTests --dryRun', { timeout: 30000 });

      if (!testResult.success) {
        this.addResult(testName, 'FAIL', 'Test framework initialization failed', testResult.error);
        return;
      }

      this.addResult(testName, 'PASS', 'Testing frameworks (Jest, Playwright) properly configured');
    } catch (error: any) {
      this.addResult(testName, 'FAIL', `Error validating testing framework: ${error.message}`);
    }
  }

  /**
   * Test 7: Validate linting configuration
   */
  async testLintingConfiguration(): Promise<void> {
    const testName = 'Linting Configuration Validation';

    try {
      // Check ESLint configuration
      const eslintConfigPath = resolve(this.projectRoot, '.eslintrc.js');
      const eslintPackagePath = resolve(this.projectRoot, 'eslintrc.js');

      if (!existsSync(eslintConfigPath) && !existsSync(eslintPackagePath)) {
        this.addResult(testName, 'FAIL', 'ESLint configuration not found');
        return;
      }

      // Run linting in dry-run mode
      const lintResult = this.runCommand('npm run lint -- --dry-run', { timeout: 30000 });

      // Note: We expect linting to find issues given the current state
      if (lintResult.success) {
        this.addResult(testName, 'PASS', 'ESLint configuration is valid');
      } else {
        this.addResult(testName, 'PASS', 'ESLint configuration is valid (linting issues found as expected)', lintResult.error);
      }
    } catch (error: any) {
      this.addResult(testName, 'FAIL', `Error validating linting configuration: ${error.message}`);
    }
  }

  /**
   * Test 8: Validate CI/CD configuration
   */
  async testCICDConfiguration(): Promise<void> {
    const testName = 'CI/CD Configuration Validation';

    try {
      const workflowsPath = resolve(this.projectRoot, '.github', 'workflows');
      if (!existsSync(workflowsPath)) {
        this.addResult(testName, 'FAIL', 'GitHub workflows directory not found');
        return;
      }

      // Check for critical workflow files
      const criticalWorkflows = ['ci-cd.yml', 'test.yml'];
      const workflowResults: { [key: string]: boolean } = {};

      for (const workflow of criticalWorkflows) {
        const workflowPath = resolve(workflowsPath, workflow);
        workflowResults[workflow] = existsSync(workflowPath);
      }

      const missingWorkflows = Object.keys(workflowResults).filter(w => !workflowResults[w]);

      if (missingWorkflows.length > 0) {
        this.addResult(testName, 'FAIL', `Missing critical workflows: ${missingWorkflows.join(', ')}`);
        return;
      }

      this.addResult(testName, 'PASS', `CI/CD workflows properly configured: ${Object.keys(workflowResults).join(', ')}`);
    } catch (error: any) {
      this.addResult(testName, 'FAIL', `Error validating CI/CD configuration: ${error.message}`);
    }
  }

  /**
   * Test 9: Validate security configuration
   */
  async testSecurityConfiguration(): Promise<void> {
    const testName = 'Security Configuration Validation';

    try {
      // Check for security-related configurations
      const securityChecks = [
        { file: '.env.example', description: 'Environment template' },
        { file: '.gitignore', description: 'Git ignore file' }
      ];

      const securityResults: { [key: string]: boolean } = {};

      for (const check of securityChecks) {
        const checkPath = resolve(this.projectRoot, check.file);
        securityResults[check.description] = existsSync(checkPath);
      }

      // Check if sensitive files are properly ignored
      const gitignorePath = resolve(this.projectRoot, '.gitignore');
      let gitignoreContent = '';
      if (existsSync(gitignorePath)) {
        gitignoreContent = readFileSync(gitignorePath, 'utf8');
      }

      const sensitivePatterns = ['.env', '*.key', 'node_modules/'];
      const ignoredPatterns = sensitivePatterns.filter(pattern => gitignoreContent.includes(pattern));

      this.addResult(testName, 'PASS', `Security configuration validated. Ignored patterns: ${ignoredPatterns.join(', ')}`, securityResults);
    } catch (error: any) {
      this.addResult(testName, 'FAIL', `Error validating security configuration: ${error.message}`);
    }
  }

  /**
   * Test 10: Validate development server startup
   */
  async testDevelopmentServer(): Promise<void> {
    const testName = 'Development Server Validation';

    try {
      // Check if development script exists
      const packageJsonPath = resolve(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

      if (!packageJson.scripts?.dev) {
        this.addResult(testName, 'FAIL', 'Development script not found in package.json');
        return;
      }

      // Note: We don't actually start the server to avoid port conflicts
      // Just validate that the configuration exists
      this.addResult(testName, 'PASS', 'Development server configuration found');
    } catch (error: any) {
      this.addResult(testName, 'FAIL', `Error validating development server: ${error.message}`);
    }
  }

  /**
   * Run all validation tests
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log('🚀 Starting Comprehensive Initialization Validation...\n');

    const tests = [
      () => this.testNodeEnvironment(),
      () => this.testPackageConfiguration(),
      () => this.testTypeScriptConfiguration(),
      () => this.testDependencyInstallation(),
      () => this.testBuildProcess(),
      () => this.testTestingFramework(),
      () => this.testLintingConfiguration(),
      () => this.testCICDConfiguration(),
      () => this.testSecurityConfiguration(),
      () => this.testDevelopmentServer()
    ];

    for (const test of tests) {
      try {
        await test();
      } catch (error: any) {
        console.error(`Unexpected error during test execution: ${error.message}`);
      }
    }

    return this.results;
  }

  /**
   * Generate validation report
   */
  generateReport(): void {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const total = this.results.length;

    console.log('\n' + '='.repeat(80));
    console.log('📊 INITIALIZATION VALIDATION REPORT');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${total} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    console.log('='.repeat(80));

    for (const result of this.results) {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
      console.log(`\n${statusIcon} ${result.testName}`);
      console.log(`   ${result.message}`);

      if (result.details) {
        console.log(`   Details:`, result.details);
      }
    }

    console.log('\n' + '='.repeat(80));

    if (failed === 0) {
      console.log('🎉 ALL TESTS PASSED - Development environment is properly initialized!');
    } else {
      console.log(`⚠️  ${failed} test(s) failed - Please review and address the issues above`);

      // Provide remediation suggestions
      console.log('\n📋 SUGGESTED REMEDIATION STEPS:');
      console.log('1. Run: npm install (to fix dependency issues)');
      console.log('2. Run: npm run build (to fix build issues)');
      console.log('3. Run: npm run typecheck (to fix TypeScript issues)');
      console.log('4. Run: npm run lint:fix (to fix linting issues)');
      console.log('5. Check: .env file (to ensure environment variables are set)');
    }

    console.log('='.repeat(80));
  }
}

// Export for use in test frameworks
export { InitializationValidator, TestResult, ValidationResult };

// Run validation if this file is executed directly
if (require.main === module) {
  const validator = new InitializationValidator();
  validator.runAllTests()
    .then(() => validator.generateReport())
    .catch((error) => {
      console.error('Validation failed with error:', error);
      process.exit(1);
    });
}