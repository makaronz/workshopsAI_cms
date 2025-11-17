/**
 * Puppeteer Logger Utility
 * Comprehensive logging utilities for Puppeteer debugging
 */

import { Page, Browser, Request, Response } from 'puppeteer';

export interface LogEntry {
  timestamp: string;
  type: 'request' | 'response' | 'error' | 'console' | 'network';
  details: any;
}

export class PuppeteerLogger {
  private logs: LogEntry[] = [];
  private page: Page;
  private browser: Browser;

  constructor(page: Page, browser: Browser) {
    this.page = page;
    this.browser = browser;
  }

  /**
   * Enable comprehensive logging for all Puppeteer events
   */
  enableAllLogging(): void {
    console.log('🔧 Enabling comprehensive Puppeteer logging...');

    this.setupRequestLogging();
    this.setupResponseLogging();
    this.setupConsoleLogging();
    this.setupErrorLogging();
    this.setupNetworkLogging();
  }

  /**
   * Setup detailed request logging with request interception
   */
  async setupRequestLogging(): Promise<void> {
    console.log('📤 Setting up request logging...');

    try {
      await this.page.setRequestInterception(true);

      this.page.on('request', (request: Request) => {
        const logEntry: LogEntry = {
          timestamp: new Date().toISOString(),
          type: 'request',
          details: {
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            resourceType: request.resourceType(),
            postData: request.postData()
          }
        };

        this.logs.push(logEntry);

        // Log important requests
        if (this.isImportantRequest(request.url())) {
          console.log(`\n📤 REQUEST: ${request.method()} ${request.url()}`);
          console.log(`   Headers: ${JSON.stringify(request.headers(), null, 2)}`);

          if (request.postData()) {
            try {
              const postData = JSON.parse(request.postData()!);
              console.log(`   Body: ${JSON.stringify(postData, null, 2)}`);
            } catch {
              console.log(`   Body: ${request.postData()}`);
            }
          }
        }

        // Continue the request
        request.continue().catch(error => {
          console.error(`❌ Failed to continue request: ${error.message}`);
          this.logError('request_continue', error, { url: request.url() });
        });
      });

    } catch (error) {
      console.error('❌ Failed to setup request interception:', error);
      this.logError('request_setup', error);
    }
  }

  /**
   * Setup detailed response logging with body capture
   */
  setupResponseLogging(): void {
    console.log('📥 Setting up response logging...');

    this.page.on('response', async (response: Response) => {
      const url = response.url();
      const status = response.status();

      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        type: 'response',
        details: {
          url: url,
          status: status,
          statusText: response.statusText(),
          headers: response.headers(),
          fromServiceWorker: response.fromServiceWorker(),
          fromCache: response.fromCache()
        }
      };

      try {
        // Capture response body for important responses
        if (this.isImportantResponse(url, status)) {
          const body = await response.text();
          logEntry.details.body = body;

          console.log(`\n📥 RESPONSE: ${status} ${response.statusText()} ${url}`);
          console.log(`   Headers: ${JSON.stringify(response.headers(), null, 2)}`);

          if (status >= 400) {
            console.log(`   ❌ Error Body: ${body}`);

            // Try to parse JSON errors
            try {
              const jsonBody = JSON.parse(body);
              console.log(`   Parsed Error: ${JSON.stringify(jsonBody, null, 2)}`);
            } catch {
              console.log(`   Raw error body (not JSON)`);
            }
          } else {
            console.log(`   ✅ Success Body: ${body}`);

            // Check for authentication tokens
            try {
              const jsonBody = JSON.parse(body);
              if (jsonBody.access_token) {
                console.log(`   🔐 Access Token: ${jsonBody.access_token.length} chars`);
              }
              if (jsonBody.refresh_token) {
                console.log(`   🔐 Refresh Token: ${jsonBody.refresh_token.length} chars`);
              }
            } catch {
              console.log(`   Response body (not JSON)`);
            }
          }
        }
      } catch (error) {
        console.log(`   Could not read response body: ${error.message}`);
        logEntry.details.bodyError = error.message;
      }

      this.logs.push(logEntry);
    });
  }

  /**
   * Setup browser console logging
   */
  setupConsoleLogging(): void {
    console.log('🖥️ Setting up console logging...');

    this.page.on('console', (msg) => {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        type: 'console',
        details: {
          type: msg.type(),
          text: msg.text(),
          location: msg.location()
        }
      };

      this.logs.push(logEntry);

      switch (msg.type()) {
        case 'error':
          console.log(`🟥 Browser Error: ${msg.text()}`);
          break;
        case 'warning':
          console.log(`🟧 Browser Warning: ${msg.text()}`);
          break;
        case 'info':
          console.log(`💡 Browser Info: ${msg.text()}`);
          break;
        case 'log':
          console.log(`📝 Browser Log: ${msg.text()}`);
          break;
        default:
          console.log(`📋 Browser ${msg.type()}: ${msg.text()}`);
      }
    });
  }

  /**
   * Setup error logging for various Puppeteer events
   */
  setupErrorLogging(): void {
    console.log('💥 Setting up error logging...');

    // JavaScript errors
    this.page.on('pageerror', (error) => {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        type: 'error',
        details: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      };

      this.logs.push(logEntry);

      console.log(`\n💥 JavaScript Error:`);
      console.log(`   Message: ${error.message}`);
      console.log(`   Name: ${error.name}`);
      console.log(`   Stack: ${error.stack}`);
    });

    // Request failures
    this.page.on('requestfailed', (request) => {
      const failure = request.failure();

      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        type: 'error',
        details: {
          url: request.url(),
          failure: failure ? {
            errorText: failure.errorText,
            errorType: failure.errorType
          } : null
        }
      };

      this.logs.push(logEntry);

      console.log(`\n💥 Request Failed:`);
      console.log(`   URL: ${request.url()}`);
      if (failure) {
        console.log(`   Error: ${failure.errorText}`);
        console.log(`   Type: ${failure.errorType}`);
      }
    });

    // Worker errors
    this.page.on('workererror', (error) => {
      this.logError('worker_error', error);
    });
  }

  /**
   * Setup network-related logging
   */
  setupNetworkLogging(): void {
    console.log('🌐 Setting up network logging...');

    // Target events
    this.browser.on('targetcreated', (target) => {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        type: 'network',
        details: {
          event: 'target_created',
          target: {
            url: target.url(),
            type: target.type()
          }
        }
      };

      this.logs.push(logEntry);
      console.log(`🎯 Target Created: ${target.type()} - ${target.url()}`);
    });

    this.browser.on('targetchanged', (target) => {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        type: 'network',
        details: {
          event: 'target_changed',
          target: {
            url: target.url(),
            type: target.type()
          }
        }
      };

      this.logs.push(logEntry);
      console.log(`🎯 Target Changed: ${target.type()} - ${target.url()}`);
    });

    this.browser.on('targetdestroyed', (target) => {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        type: 'network',
        details: {
          event: 'target_destroyed',
          target: {
            url: target.url(),
            type: target.type()
          }
        }
      };

      this.logs.push(logEntry);
      console.log(`🎯 Target Destroyed: ${target.type()} - ${target.url()}`);
    });
  }

  /**
   * Check if a request is important for logging
   */
  private isImportantRequest(url: string): boolean {
    return url.includes('/api/auth/') ||
           url.includes('/api/login') ||
           url.includes('/login') ||
           url.includes('/auth/') ||
           url.includes('/token') ||
           url.includes('/session');
  }

  /**
   * Check if a response is important for logging
   */
  private isImportantResponse(url: string, status: number): boolean {
    return this.isImportantRequest(url) || status >= 400;
  }

  /**
   * Log an error with context
   */
  private logError(type: string, error: any, context?: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'error',
      details: {
        errorType: type,
        message: error.message || error,
        stack: error.stack,
        context
      }
    };

    this.logs.push(logEntry);
    console.log(`💥 Error (${type}): ${error.message || error}`);
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return this.logs;
  }

  /**
   * Get logs by type
   */
  getLogsByType(type: LogEntry['type']): LogEntry[] {
    return this.logs.filter(log => log.type === type);
  }

  /**
   * Get authentication-related logs
   */
  getAuthLogs(): LogEntry[] {
    return this.logs.filter(log =>
      this.isImportantRequest(log.details.url || '')
    );
  }

  /**
   * Export logs to file
   */
  async exportLogs(filePath: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(filePath, JSON.stringify(this.logs, null, 2));
    console.log(`📁 Logs exported to: ${filePath}`);
  }

  /**
   * Print summary of authentication requests
   */
  printAuthSummary(): void {
    const authLogs = this.getAuthLogs();

    console.log('\n📊 Authentication Request Summary:');
    console.log(`   Total auth-related requests: ${authLogs.length}`);

    authLogs.forEach(log => {
      const { type, details } = log;
      const { url, status, method } = details;

      if (type === 'request') {
        console.log(`   📤 ${method} ${url}`);
      } else if (type === 'response') {
        const statusIcon = status >= 400 ? '❌' : '✅';
        console.log(`   ${statusIcon} ${status} ${url}`);
      }
    });
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }
}

/**
 * Create a new PuppeteerLogger instance
 */
export function createLogger(page: Page, browser: Browser): PuppeteerLogger {
  return new PuppeteerLogger(page, browser);
}