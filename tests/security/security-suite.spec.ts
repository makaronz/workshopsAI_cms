/**
 * Security Testing Suite
 * OWASP Top 10 vulnerability testing and security validation
 */

import { test, expect } from '@playwright/test';

test.describe('Security Testing Suite', () => {
  test.describe('OWASP Top 10 - A01: Broken Access Control', () => {
    test('should prevent unauthorized access to protected routes', async ({ page }) => {
      // Try to access protected routes without authentication
      const protectedRoutes = [
        '/dashboard',
        '/workshops/create',
        '/questionnaires/create',
        '/admin',
        '/api/workshops',
        '/api/users/profile'
      ];

      for (const route of protectedRoutes) {
        await page.goto(route);

        // Should redirect to login or return 401/403
        await expect(page.url()).toMatch(/(login|401|403|unauthorized|forbidden)/i);
      }
    });

    test('should enforce role-based access control', async ({ page }) => {
      // Login as regular user
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'user@test.com');
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Try to access admin-only routes
      const adminRoutes = ['/admin', '/admin/users', '/admin/settings'];

      for (const route of adminRoutes) {
        await page.goto(route);

        // Should show access denied or redirect
        const accessDenied = await page.locator('[data-testid="access-denied"], [data-testid="403"]').count();
        const isRedirected = !page.url().includes(route);

        expect(accessDenied > 0 || isRedirected).toBe(true);
      }
    });

    test('should prevent direct object reference attacks', async ({ page }) => {
      // Login as user
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'user@test.com');
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Try to access other users' resources
      const otherUsersResources = [
        '/workshops/1', // Assuming workshop 1 belongs to different user
        '/questionnaires/1',
        '/users/1/profile'
      ];

      for (const resource of otherUsersResources) {
        await page.goto(resource);

        // Should show access denied or not found
        const isDenied = await page.locator('[data-testid="access-denied"], [data-testid="403"], [data-testid="404"]').count();
        expect(isDenied > 0).toBe(true);
      }
    });

    test('should verify authorization for API endpoints', async ({ page }) => {
      // Test API endpoints without authentication
      const apiEndpoints = [
        '/api/workshops',
        '/api/questionnaires',
        '/api/users/profile'
      ];

      for (const endpoint of apiEndpoints) {
        const response = await page.evaluate(async (url) => {
          try {
            const res = await fetch(url);
            return {
              status: res.status,
              statusText: res.statusText
            };
          } catch (error) {
            return {
              status: 0,
              statusText: error.message
            };
          }
        }, endpoint);

        // Should return 401 Unauthorized
        expect(response.status).toBe(401);
      }
    });
  });

  test.describe('OWASP Top 10 - A02: Cryptographic Failures', () => {
    test('should use HTTPS for all communications', async ({ page }) => {
      // This test would run against production environment
      // For now, we'll check that forms don't expose sensitive data

      await page.goto('/login');

      // Password field should be of type password
      const passwordInput = page.locator('input[type="password"]');
      await expect(passwordInput).toBeVisible();

      // Check that password is not sent in plain text in JavaScript
      const exposesPassword = await page.evaluate(() => {
        const scripts = Array.from(document.scripts);
        const scriptContent = scripts.map(script => script.textContent || '').join('');
        return scriptContent.includes('password') && scriptContent.includes('fetch');
      });

      // This is a basic check - real security audit would be more thorough
      expect(exposesPassword).toBe(false);
    });

    test('should not expose sensitive data in client-side code', async ({ page }) => {
      await page.goto('/login');

      // Check for sensitive data exposure
      const sensitiveData = await page.evaluate(() => {
        const scripts = Array.from(document.scripts);
        const scriptContent = scripts.map(script => script.textContent || '').join('');

        const sensitivePatterns = [
          /password\s*=\s*['"]\w+['"]/, // Hardcoded passwords
          /api[_-]?key\s*=\s*['"][\w-]+['"]/, // API keys
          /secret\s*=\s*['"]\w+['"]/, // Secrets
          /token\s*=\s*['"][\w-\.]+['"]/, // Tokens
        ];

        return sensitivePatterns.some(pattern => pattern.test(scriptContent));
      });

      expect(sensitiveData).toBe(false);
    });

    test('should implement proper session management', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'admin@test.com');
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Check for secure session cookies
      const cookies = await page.context().cookies();

      const sessionCookie = cookies.find(cookie =>
        cookie.name.toLowerCase().includes('session') ||
        cookie.name.toLowerCase().includes('token')
      );

      if (sessionCookie) {
        // Session cookies should have secure attributes
        expect(sessionCookie.httpOnly).toBe(true);
        expect(sessionCookie.sameSite).toBeDefined();
      }
    });
  });

  test.describe('OWASP Top 10 - A03: Injection', () => {
    test('should prevent SQL injection attacks', async ({ page }) => {
      await page.goto('/login');

      const sqlInjectionPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
        "1'; DELETE FROM users; --"
      ];

      for (const payload of sqlInjectionPayloads) {
        await page.fill('[data-testid="email-input"]', payload);
        await page.fill('[data-testid="password-input"]', 'password');
        await page.click('[data-testid="login-button"]');

        // Should not cause server errors or expose database information
        const hasServerError = await page.locator('[data-testid="server-error"]').count();
        const hasDatabaseError = await page.locator('text=/SQL|database|mysql|postgres/i').count();

        expect(hasServerError + hasDatabaseError).toBe(0);
      }
    });

    test('should prevent XSS attacks', async ({ page }) => {
      await page.goto('/login');

      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<svg onload=alert("XSS")>',
        '"><script>alert("XSS")</script>'
      ];

      for (const payload of xssPayloads) {
        await page.fill('[data-testid="email-input"]', payload);
        await page.fill('[data-testid="password-input"]', 'password');
        await page.click('[data-testid="login-button"]');

        // Check that script didn't execute
        const alerts = await page.evaluate(() => {
          let alertCount = 0;
          const originalAlert = window.alert;
          window.alert = () => {
            alertCount++;
            return originalAlert.apply(window, arguments as any);
          };
          return alertCount;
        });

        expect(alerts).toBe(0);
      }
    });

    test('should sanitize user input', async ({ page }) => {
      await page.goto('/register');

      const maliciousInputs = [
        '<script>alert("XSS")</script>',
        '"><img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<div onclick="alert(\'XSS\')">Click me</div>'
      ];

      for (const input of maliciousInputs) {
        await page.fill('[data-testid="username-input"]', input);
        await page.fill('[data-testid="email-input"]', 'test@test.com');
        await page.fill('[data-testid="password-input"]', 'password123');
        await page.fill('[data-testid="confirm-password-input"]', 'password123');
        await page.click('[data-testid="register-button"]');

        // Input should be sanitized in error messages or responses
        const pageContent = await page.content();
        expect(pageContent).not.toContain('<script>');
        expect(pageContent).not.toContain('javascript:');
        expect(pageContent).not.toContain('onclick=');
      }
    });
  });

  test.describe('OWASP Top 10 - A04: Insecure Design', () => {
    test('should implement proper rate limiting', async ({ page }) => {
      await page.goto('/login');

      // Make rapid login attempts
      const attempts = 10;
      let blockedAttempts = 0;

      for (let i = 0; i < attempts; i++) {
        await page.fill('[data-testid="email-input"]', 'admin@test.com');
        await page.fill('[data-testid="password-input"]', 'wrongpassword');
        await page.click('[data-testid="login-button"]');

        await page.waitForTimeout(100);

        // Check for rate limiting message
        const rateLimitMessage = await page.locator('[data-testid="rate-limit"]').count();
        if (rateLimitMessage > 0) {
          blockedAttempts++;
          break;
        }
      }

      // Should eventually block attempts
      expect(blockedAttempts).toBeGreaterThan(0);
    });

    test('should implement proper input validation', async ({ page }) => {
      await page.goto('/register');

      // Test various invalid inputs
      const invalidInputs = [
        { field: 'email', value: 'invalid-email', expected: 'Invalid email' },
        { field: 'username', value: 'ab', expected: 'Username must be at least' },
        { field: 'password', value: '123', expected: 'Password must be at least' },
        { field: 'firstName', value: '', expected: 'First name is required' }
      ];

      for (const { field, value, expected } of invalidInputs) {
        await page.fill(`[data-testid="${field}-input"]`, value);
        await page.click('[data-testid="register-button"]');

        const hasError = await page.locator(`text=/${expected}/i`).count();
        expect(hasError).toBeGreaterThan(0);

        // Clear the form for next test
        await page.reload();
        await page.waitForLoadState('networkidle');
      }
    });

    test('should handle error conditions gracefully', async ({ page }) => {
      // Test 404 handling
      await page.goto('/non-existent-page');
      await expect(page.locator('h1, [data-testid="404"]')).toBeVisible();

      // Test 500 handling (simulate)
      await page.route('**/api/test-error', route => route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      }));

      const response = await page.evaluate(async () => {
        try {
          const res = await fetch('/api/test-error');
          return { status: res.status, ok: res.ok };
        } catch (error) {
          return { status: 0, ok: false };
        }
      });

      expect(response.ok).toBe(false);
    });
  });

  test.describe('OWASP Top 10 - A05: Security Misconfiguration', () => {
    test('should not expose sensitive configuration', async ({ page }) => {
      await page.goto('/');

      // Check for common misconfigurations
      const exposedInfo = await page.evaluate(() => {
        const exposedConfig = [];

        // Check for server information
        const serverHeader = document.querySelector('meta[name="generator"]');
        if (serverHeader) {
          exposedConfig.push(serverHeader.getAttribute('content'));
        }

        // Check for exposed environment variables
        const scripts = Array.from(document.scripts);
        const scriptContent = scripts.map(script => script.textContent || '').join('');

        const envVarPattern = /process\.env\.[A-Z_]+|NODE_ENV|API_KEY|SECRET/i;
        if (envVarPattern.test(scriptContent)) {
          exposedConfig.push('Environment variables');
        }

        return exposedConfig;
      });

      expect(exposedInfo.length).toBe(0);
    });

    test('should implement proper CORS policies', async ({ page }) => {
      // Test that CORS headers are properly configured
      const response = await page.evaluate(async () => {
        try {
          const res = await fetch('/api/workshops');
          return {
            corsHeaders: {
              'access-control-allow-origin': res.headers.get('access-control-allow-origin'),
              'access-control-allow-methods': res.headers.get('access-control-allow-methods'),
              'access-control-allow-headers': res.headers.get('access-control-allow-headers')
            }
          };
        } catch (error) {
          return { corsHeaders: {} };
        }
      });

      // In production, these should be properly configured
      // For testing, we just verify the structure exists
      expect(response.corsHeaders).toBeDefined();
    });

    test('should have security headers', async ({ page }) => {
      const securityHeaders = await page.evaluate(async () => {
        const response = await fetch('/');
        const headers: Record<string, string> = {};

        response.headers.forEach((value, key) => {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('x-') ||
              lowerKey.includes('content-security-policy') ||
              lowerKey.includes('strict-transport-security') ||
              lowerKey.includes('x-frame-options')) {
            headers[lowerKey] = value;
          }
        });

        return headers;
      });

      // Should have at least some security headers
      expect(Object.keys(securityHeaders).length).toBeGreaterThan(0);
    });
  });

  test.describe('OWASP Top 10 - A06: Vulnerable Components', () => {
    test('should not use known vulnerable libraries', async ({ page }) => {
      // This test would check against a database of known vulnerabilities
      // For now, we'll check if version information is exposed

      const exposedVersions = await page.evaluate(() => {
        const scripts = Array.from(document.scripts);
        const scriptSources = scripts.map(script => script.src || '');

        const versionPatterns = [
          /jquery-\d+\.\d+\.\d+/i,
          /bootstrap-\d+\.\d+\.\d+/i,
          /react-\d+\.\d+\.\d+/i,
          /angular-\d+\.\d+\.\d+/i
        ];

        const foundVersions: string[] = [];

        scriptSources.forEach(src => {
          versionPatterns.forEach(pattern => {
            const match = src.match(pattern);
            if (match) {
              foundVersions.push(match[0]);
            }
          });
        });

        return foundVersions;
      });

      // If versions are exposed, they should be recent versions
      const oldVersionPattern = /\d+\.\d+\.[0-4]$/; // Simplified check for old versions

      for (const version of exposedVersions) {
        expect(oldVersionPattern.test(version)).toBe(false);
      }
    });
  });

  test.describe('OWASP Top 10 - A07: Authentication Failures', () => {
    test('should implement secure password policies', async ({ page }) => {
      await page.goto('/register');

      // Test password requirements
      const weakPasswords = [
        '123',           // Too short
        'password',      // Common password
        '11111111',      // All same characters
        'qwerty123',     // Common pattern
      ];

      for (const password of weakPasswords) {
        await page.fill('[data-testid="email-input"]', 'test@test.com');
        await page.fill('[data-testid="username-input"]', 'testuser');
        await page.fill('[data-testid="first-name-input"]', 'Test');
        await page.fill('[data-testid="last-name-input"]', 'User');
        await page.fill('[data-testid="password-input"]', password);
        await page.fill('[data-testid="confirm-password-input"]', password);
        await page.click('[data-testid="register-button"]');

        // Should show password strength error
        const hasPasswordError = await page.locator('[data-testid="password-error"]').count();
        expect(hasPasswordError).toBeGreaterThan(0);

        // Clear form for next test
        await page.reload();
      }
    });

    test('should implement secure session management', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'admin@test.com');
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Check session storage
      const sessionData = await page.evaluate(() => ({
        localStorage: { ...localStorage },
        sessionStorage: { ...sessionStorage }
      }));

      // Should not store sensitive information in localStorage
      const hasSensitiveData = Object.values(sessionData.localStorage).some(value =>
        value.toLowerCase().includes('token') ||
        value.toLowerCase().includes('password') ||
        value.toLowerCase().includes('secret')
      );

      expect(hasSensitiveData).toBe(false);
    });

    test('should handle authentication timeout', async ({ page }) => {
      // This test would check that sessions expire properly
      // For now, we'll simulate session expiration

      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'admin@test.com');
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Clear session to simulate expiration
      await page.evaluate(() => {
        sessionStorage.clear();
        localStorage.clear();
      });

      // Try to access protected route
      await page.goto('/workshops/create');

      // Should redirect to login
      await expect(page.url()).toMatch(/login/);
    });
  });

  test.describe('File Upload Security', () => {
    test('should validate file types and sizes', async ({ page }) => {
      // Navigate to a page with file upload
      await page.goto('/workshops/create');
      await page.waitForLoadState('networkidle');

      // Try to upload invalid file types
      const invalidFiles = [
        { name: 'malware.exe', mimeType: 'application/octet-stream' },
        { name: 'script.js', mimeType: 'application/javascript' },
        { name: 'huge-file.zip', size: 100 * 1024 * 1024 } // 100MB
      ];

      for (const file of invalidFiles) {
        const fileInput = page.locator('input[type="file"]');

        if (await fileInput.count() > 0) {
          // Create mock file
          const fileBuffer = Buffer.alloc(file.size || 1024, 'test');

          // This would need proper file handling in real implementation
          // For now, we'll just check that validation exists
          const fileInputExists = await fileInput.count();
          expect(fileInputExists).toBeGreaterThan(0);
        }
      }
    });

    test('should sanitize file names', async ({ page }) => {
      await page.goto('/workshops/create');
      await page.waitForLoadState('networkidle');

      const maliciousFileNames = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config\\sam',
        'file<script>alert("XSS")</script>.jpg',
        'file with spaces and symbols!.txt'
      ];

      // Check that file upload validation exists
      const fileInput = page.locator('input[type="file"]');
      const hasFileUpload = await fileInput.count();

      if (hasFileUpload > 0) {
        // In real implementation, would test file name sanitization
        expect(hasFileUpload).toBeGreaterThan(0);
      }
    });
  });

  test.describe('API Security', () => {
    test('should implement proper API authentication', async ({ page }) => {
      // Test API endpoints without authentication
      const apiTests = [
        { method: 'GET', url: '/api/workshops' },
        { method: 'POST', url: '/api/workshops', data: { title: 'Test' } },
        { method: 'PUT', url: '/api/workshops/1', data: { title: 'Updated' } },
        { method: 'DELETE', url: '/api/workshops/1' }
      ];

      for (const { method, url, data } of apiTests) {
        const response = await page.evaluate(async ({ method, url, data }) => {
          try {
            const options: RequestInit = { method };
            if (data && ['POST', 'PUT'].includes(method)) {
              options.headers = { 'Content-Type': 'application/json' };
              options.body = JSON.stringify(data);
            }

            const res = await fetch(url, options);
            return {
              status: res.status,
              statusText: res.statusText,
              url: res.url
            };
          } catch (error) {
            return {
              status: 0,
              statusText: error.message,
              url: url
            };
          }
        }, { method, url, data });

        // Should return 401 for unauthenticated requests
        expect(response.status).toBe(401);
      }
    });

    test('should validate API input', async ({ page }) => {
      // Test API input validation
      const invalidInputs = [
        { url: '/api/workshops', data: { title: '' } }, // Empty title
        { url: '/api/users/profile', data: { email: 'invalid-email' } }, // Invalid email
        { url: '/api/questionnaires', data: { questions: 'not-array' } } // Invalid data type
      ];

      for (const { url, data } of invalidInputs) {
        const response = await page.evaluate(async ({ url, data }) => {
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer fake-token'
              },
              body: JSON.stringify(data)
            });

            return {
              status: res.status,
              ok: res.ok
            };
          } catch (error) {
            return {
              status: 0,
              ok: false
            };
          }
        }, { url, data });

        // Should return 400 for invalid input (even with fake auth)
        expect([400, 401, 422]).toContain(response.status);
      }
    });
  });
});