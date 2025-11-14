#!/usr/bin/env node

/**
 * OWASP ZAP Integration for Security Testing
 * Automated vulnerability scanning and security monitoring
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const axios = require('axios');

class ZAPIntegration {
  constructor(options = {}) {
    this.zapApiUrl = options.zapApiUrl || 'http://localhost:8080';
    this.apiKey = options.apiKey || process.env.ZAP_API_KEY || '';
    this.targetUrl = options.targetUrl || 'http://localhost:3001';
    this.reportDir = options.reportDir || './security-reports';
    this.contextId = null;

    // Create reports directory
    this.ensureReportDir();
  }

  ensureReportDir() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  async init() {
    console.log('🔒 Initializing OWASP ZAP integration...');

    try {
      // Check if ZAP is running
      await this.checkZAPStatus();

      // Configure target
      await this.configureTarget();

      // Create context for the application
      await this.createContext();

      console.log('✅ ZAP integration initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize ZAP:', error.message);
      throw error;
    }
  }

  async checkZAPStatus() {
    try {
      const response = await axios.get(`${this.zapApiUrl}/JSON/core/view/version/`);
      console.log(`📊 ZAP Version: ${response.data.version}`);
      return response.data;
    } catch (error) {
      throw new Error('ZAP is not running or not accessible. Please start ZAP and try again.');
    }
  }

  async configureTarget() {
    console.log(`🎯 Configuring target: ${this.targetUrl}`);

    // Set target URL in ZAP
    await this.makeRequest('core', 'setOptionDefaultUserAgent', {
      userAgent: 'WorkshopsAI-Security-Scanner/1.0'
    });

    // Configure spider options
    await this.makeRequest('spider', 'setOptionMaxDepth', { maxDepth: '10' });
    await this.makeRequest('spider', 'setOptionMaxChildren', { maxChildren: '100' });
    await this.makeRequest('spider', 'setOptionAcceptCookies', { acceptCookies: 'true' });

    // Configure active scan options
    await this.makeRequest('ascan', 'setOptionMaxScanDurationInMins', { maxScanDurationInMins: '60' });
    await this.makeRequest('ascan', 'setOptionThreadPerHost', { threadPerHost: '5' });
    await this.makeRequest('ascan', 'setOptionDelayInMs', { delayInMs: '0' });
  }

  async createContext() {
    console.log('📁 Creating security context...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const contextName = `WorkshopsAI-CMS-${timestamp}`;

    // Create context
    const contextResponse = await this.makeRequest('context', 'newContext', {
      contextName
    });

    this.contextId = contextResponse.contextId;

    // Include target URL in context
    await this.makeRequest('context', 'includeInContext', {
      contextName,
      regex: `${this.targetUrl}.*`
    });

    // Set context as default
    await this.makeRequest('context', 'setDefaultContext', {
      contextName
    });

    console.log(`✅ Context created: ${contextName} (ID: ${this.contextId})`);
  }

  async runSpiderScan() {
    console.log('🕷️ Starting spider scan...');

    const spiderResponse = await this.makeRequest('spider', 'scan', {
      url: this.targetUrl,
      maxChildren: '100',
      recurse: 'true',
      contextName: `WorkshopsAI-CMS-*`
    });

    const scanId = spiderResponse.scan;
    console.log(`🔍 Spider scan started: ${scanId}`);

    // Monitor scan progress
    return this.monitorScan('spider', scanId);
  }

  async runActiveScan() {
    console.log('🔍 Starting active security scan...');

    const ascanResponse = await this.makeRequest('ascan', 'scan', {
      url: this.targetUrl,
      recurse: 'true',
      inScopeOnly: 'true',
      scanPolicyName: 'Default Policy',
      method: 'GET',
      postData: ''
    });

    const scanId = ascanResponse.scan;
    console.log(`🛡️ Active scan started: ${scanId}`);

    // Monitor scan progress
    return this.monitorScan('ascan', scanId);
  }

  async monitorScan(scanType, scanId) {
    const maxWaitTime = 30 * 60 * 1000; // 30 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const statusResponse = await this.makeRequest(scanType, 'status', {
          scanId
        });

        const progress = parseInt(statusResponse.status);
        const recordsToScan = statusResponse.recordsToScan || 0;
        const recordsScanned = statusResponse.recordsScanned || 0;

        console.log(`📊 ${scanType.toUpperCase()} Progress: ${progress}% (${recordsScanned}/${recordsToScan})`);

        if (progress >= 100) {
          console.log(`✅ ${scanType.toUpperCase()} scan completed`);
          return { scanId, progress: 100 };
        }

        // Wait 5 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error(`❌ Error monitoring ${scanType} scan:`, error.message);
        throw error;
      }
    }

    throw new Error(`${scanType} scan timed out after ${maxWaitTime/1000/60} minutes`);
  }

  async generateReports() {
    console.log('📄 Generating security reports...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // HTML Report
    await this.generateReport('html', `${this.reportDir}/zap-report-${timestamp}.html`);

    // JSON Report
    await this.generateReport('json', `${this.reportDir}/zap-report-${timestamp}.json`);

    // Markdown Report
    await this.generateReport('md', `${this.reportDir}/zap-report-${timestamp}.md`);

    // OWASP ZAP Baseline Report
    await this.generateBaselineReport(`${this.reportDir}/zap-baseline-${timestamp}.json`);

    console.log(`✅ Reports generated in: ${this.reportDir}`);
  }

  async generateReport(format, filename) {
    try {
      const response = await this.makeRequest('core', 'htmlreport', {
        filename
      }, 'GET', false);

      console.log(`📋 ${format.toUpperCase()} report: ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to generate ${format} report:`, error.message);
    }
  }

  async generateBaselineReport(filename) {
    try {
      const response = await this.makeRequest('core', 'jsonreport', {
        filename
      }, 'GET', false);

      console.log(`📋 Baseline report: ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to generate baseline report:`, error.message);
    }
  }

  async getAlerts() {
    console.log('🚨 Retrieving security alerts...');

    try {
      const alertsResponse = await this.makeRequest('core', 'alerts', {
        baseurl: this.targetUrl,
        startPagenumber: '0',
        countPagenumber: '1000'
      });

      const alerts = alertsResponse.alerts || [];
      const highRiskAlerts = alerts.filter(alert => alert.risk === 'High');
      const mediumRiskAlerts = alerts.filter(alert => alert.risk === 'Medium');
      const lowRiskAlerts = alerts.filter(alert => alert.risk === 'Low');

      console.log(`📊 Security Summary:`);
      console.log(`   High Risk: ${highRiskAlerts.length}`);
      console.log(`   Medium Risk: ${mediumRiskAlerts.length}`);
      console.log(`   Low Risk: ${lowRiskAlerts.length}`);
      console.log(`   Total Alerts: ${alerts.length}`);

      // Save detailed alerts to file
      const alertsFile = path.join(this.reportDir, `zap-alerts-${Date.now()}.json`);
      fs.writeFileSync(alertsFile, JSON.stringify({
        summary: {
          total: alerts.length,
          high: highRiskAlerts.length,
          medium: mediumRiskAlerts.length,
          low: lowRiskAlerts.length
        },
        alerts: alerts
      }, null, 2));

      console.log(`📋 Detailed alerts saved: ${alertsFile}`);

      return {
        summary: {
          total: alerts.length,
          high: highRiskAlerts.length,
          medium: mediumRiskAlerts.length,
          low: lowRiskAlerts.length
        },
        alerts,
        alertsFile
      };
    } catch (error) {
      console.error('❌ Failed to retrieve alerts:', error.message);
      throw error;
    }
  }

  async runPassiveScan() {
    console.log('👁️ Starting passive scan...');

    // Passive scan runs automatically while spidering
    // We just need to check when it's complete
    const maxWaitTime = 10 * 60 * 1000; // 10 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const recordsResponse = await this.makeRequest('pscan', 'recordsToScan');
        const recordsToScan = parseInt(recordsResponse.recordsToScan);

        if (recordsToScan === 0) {
          console.log('✅ Passive scan completed');
          return true;
        }

        console.log(`📊 Passive scan: ${recordsToScan} records remaining`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error('❌ Error monitoring passive scan:', error.message);
        throw error;
      }
    }

    console.log('⚠️ Passive scan timeout, but continuing...');
    return false;
  }

  async makeRequest(component, action, params = {}, method = 'GET', encodeParams = true) {
    let url = `${this.zapApiUrl}/JSON/${component}/${action}/`;

    if (Object.keys(params).length > 0) {
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      url += encodeParams ? `?${queryString}` : `?${queryString.replace(/%2F/g, '/')}`;
    }

    if (this.apiKey) {
      url += (url.includes('?') ? '&' : '?') + `apiKey=${this.apiKey}`;
    }

    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      throw new Error(`ZAP API request failed: ${error.message}`);
    }
  }

  async runFullSecurityScan() {
    console.log('🛡️ Starting full security scan...');

    const startTime = Date.now();

    try {
      // 1. Spider scan
      await this.runSpiderScan();

      // 2. Passive scan
      await this.runPassiveScan();

      // 3. Active scan
      await this.runActiveScan();

      // 4. Get alerts
      const alerts = await this.getAlerts();

      // 5. Generate reports
      await this.generateReports();

      const duration = (Date.now() - startTime) / 1000 / 60; // minutes

      console.log(`✅ Full security scan completed in ${duration.toFixed(2)} minutes`);
      console.log(`📊 Results: ${alerts.summary.high} High, ${alerts.summary.medium} Medium, ${alerts.summary.low} Low risk issues`);

      return {
        duration,
        alerts,
        reportDir: this.reportDir
      };
    } catch (error) {
      console.error('❌ Security scan failed:', error.message);
      throw error;
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up ZAP session...');

    try {
      // Generate final reports before cleanup
      await this.generateReports();

      // Remove context
      if (this.contextId) {
        await this.makeRequest('context', 'removeContext', {
          contextName: `WorkshopsAI-CMS-*`
        });
      }

      // Clear sessions and alerts
      await this.makeRequest('core', 'newSession');

      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const options = {
    zapApiUrl: process.env.ZAP_API_URL || 'http://localhost:8080',
    apiKey: process.env.ZAP_API_KEY || '',
    targetUrl: process.env.TARGET_URL || 'http://localhost:3001',
    reportDir: process.env.REPORT_DIR || './security-reports'
  };

  const zap = new ZAPIntegration(options);

  try {
    switch (command) {
      case 'init':
        await zap.init();
        break;

      case 'spider':
        await zap.init();
        await zap.runSpiderScan();
        break;

      case 'passive':
        await zap.init();
        await zap.runPassiveScan();
        break;

      case 'active':
        await zap.init();
        await zap.runActiveScan();
        break;

      case 'full':
        await zap.init();
        await zap.runFullSecurityScan();
        break;

      case 'reports':
        await zap.init();
        await zap.generateReports();
        break;

      case 'alerts':
        await zap.init();
        await zap.getAlerts();
        break;

      case 'cleanup':
        await zap.cleanup();
        break;

      default:
        console.log(`
Usage: node zap-integration.js <command>

Commands:
  init      - Initialize ZAP integration
  spider    - Run spider scan only
  passive   - Run passive scan only
  active    - Run active scan only
  full      - Run complete security scan (recommended)
  reports   - Generate security reports
  alerts    - Get security alerts
  cleanup   - Clean up ZAP session

Environment Variables:
  ZAP_API_URL    - ZAP API URL (default: http://localhost:8080)
  ZAP_API_KEY     - ZAP API key
  TARGET_URL      - Target URL to scan (default: http://localhost:3001)
  REPORT_DIR      - Report output directory (default: ./security-reports)

Examples:
  node zap-integration.js full
  ZAP_API_KEY=your-key node zap-integration.js full
        `);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = ZAPIntegration;

// Run CLI if called directly
if (require.main === module) {
  main();
}