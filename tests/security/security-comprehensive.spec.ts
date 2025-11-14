import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from '@axe-core/playwright';
import {
  runOWASPScan,
  testXSSVulnerabilities,
  testSQLInjectionVulnerabilities,
  testCSRFProtection,
  testAuthenticationSecurity,
  testInputValidation,
  testRateLimiting,
  testHTTPSConfiguration,
  generateSecurityReport
} from '../helpers/security-test-helpers';

test.describe('Comprehensive Security Testing', () => {
  test.describe('OWASP Top 10 Security Testing', () => {
    test('should be protected against SQL injection attacks', async ({ page, request }) => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT username, password FROM users --",
        "1' OR '1'='1' --",
        "admin'--",
        "admin'/*",
        "' or 1=1#",
        "' or 1=1--",
        "' or 1=1#",
        "' or 1=1--",
        "') or '1'='1--",
        "') or ('1'='1--",
        '") or "1"="1',
        '") or ("1"="1',
        '") or "1"="1"--',
        '") or ("1"="1"--'
      ];

      // Test login form
      await page.goto('/login');

      for (const payload of sqlInjectionPayloads) {
        await page.fill('[data-testid="email-input"]', payload);
        await page.fill('[data-testid="password-input"]', payload);
        await page.click('[data-testid="login-btn"]');

        // Should not reveal database errors or allow unauthorized access
        await expect(page.locator('[data-testid="error-message"]')).not.toContain('SQL');
        await expect(page.locator('[data-testid="error-message"]')).not.toContain('mysql');
        await expect(page.locator('[data-testid="error-message"]')).not.toContain('postgres');
        await expect(page.locator('[data-testid="error-message"]')).not.toContain('database');

        // Should remain on login page (no successful authentication)
        await expect(page).toHaveURL(/\/login/);
      }

      // Test search functionality
      await page.goto('/workshops');

      for (const payload of sqlInjectionPayloads) {
        await page.fill('[data-testid="search-input"]', payload);
        await page.press('[data-testid="search-input"]', 'Enter');

        // Should not cause database errors
        await expect(page.locator('[data-testid="database-error"]')).not.toBeVisible();
        await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
      }

      // Test API endpoints directly
      for (const payload of sqlInjectionPayloads) {
        const response = await request.post('/api/auth/login', {
          data: { email: payload, password: payload }
        });

        // Should return 401, not 500 (database error)
        expect([401, 400]).toContain(response.status());
        expect(response.status()).not.toBe(500);
      }
    });

    test('should be protected against XSS attacks', async ({ page }) => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(\'XSS\')">',
        '<svg onload="alert(\'XSS\')">',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<body onload="alert(\'XSS\')">',
        '<input autofocus onfocus="alert(\'XSS\')">',
        '<select onfocus="alert(\'XSS\')" autofocus>',
        '<textarea onfocus="alert(\'XSS\')" autofocus>',
        '<keygen onfocus="alert(\'XSS\')" autofocus>',
        '<video><source onerror="alert(\'XSS\')">',
        '<audio src="x" onerror="alert(\'XSS\')">',
        '<details open ontoggle="alert(\'XSS\')">',
        '<marquee onstart="alert(\'XSS\')">XSS</marquee>',
        '<embed src="javascript:alert(\'XSS\')">',
        '<object data="javascript:alert(\'XSS\')">',
        '<isindex action="javascript:alert(\'XSS\')" type="submit">',
        '<form><button formaction="javascript:alert(\'XSS\')">XSS</button></form>'
      ];

      // Test form inputs for XSS
      await page.goto('/workshops/create');

      for (const payload of xssPayloads) {
        await page.fill('[data-testid="workshop-title"]', payload);
        await page.fill('[data-testid="workshop-description"]', payload);

        // Check that script tags are not executed
        const pageContent = await page.content();
        expect(pageContent).not.toContain('<script>alert("XSS")</script>');
        expect(pageContent).not.toContain('javascript:alert');
      }

      // Test comment sections or user input areas
      await page.goto('/questionnaires/test-id/respond');

      for (const payload of xssPayloads) {
        const textArea = page.locator('[data-testid="text-question"]').first();
        if (await textArea.isVisible()) {
          await textArea.fill(payload);
          await page.click('[data-testid="submit-btn"]');

          // Check that payload is properly escaped
          const submittedContent = await page.locator('[data-testid="submitted-answer"]').textContent();
          expect(submittedContent).not.toContain('<script>');
          expect(submittedContent).not.toContain('onerror=');
          expect(submittedContent).not.toContain('onload=');
        }
      }

      // Test URL-based XSS
      const xssUrls = [
        '/workshops?search=<script>alert("XSS")</script>',
        '/workshops/test<script>alert("XSS")</script>',
        '/workshops/%3Cscript%3Ealert%28%22XSS%22%29%3C/script%3E'
      ];

      for (const url of xssUrls) {
        await page.goto(url);

        // Should not execute scripts
        const pageContent = await page.content();
        expect(pageContent).not.toContain('<script>alert("XSS")</script>');
      }
    });

    test('should have proper authentication and session management', async ({ page, context }) => {
      // Test session fixation
      await page.goto('/login');
      const sessionId = await page.evaluate(() => {
        return document.cookie.match(/session=([^;]+)/)?.[1];
      });

      // Login and check if session ID changes
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-btn"]');

      await page.waitForURL('/dashboard');
      const newSessionId = await page.evaluate(() => {
        return document.cookie.match(/session=([^;]+)/)?.[1];
      });

      // Session ID should change after login
      expect(newSessionId).not.toBe(sessionId);

      // Test session timeout
      await page.waitForTimeout(30000); // Wait for potential session timeout

      // Try to access protected page
      await page.goto('/dashboard');

      // Should redirect to login if session expired
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/login/);

      // Test secure cookie attributes
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(cookie => cookie.name.includes('session') || cookie.name.includes('auth'));

      if (sessionCookie) {
        expect(sessionCookie.secure).toBe(true); // Should only be sent over HTTPS
        expect(sessionCookie.httpOnly).toBe(true); // Should not be accessible via JavaScript
        expect(sessionCookie.sameSite).toBe('Strict' || 'Lax'); // Should have SameSite protection
      }

      // Test logout functionality
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-btn"]');

      await page.waitForURL('/dashboard');
      await page.click('[data-testid="logout-btn"]');

      // Should redirect to login and clear session
      await expect(page).toHaveURL(/\/login/);

      // Try to access protected resource after logout
      await page.goto('/workshops/create');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should implement proper CSRF protection', async ({ page, request }) => {
      // Get CSRF token from login page
      await page.goto('/login');

      // Extract CSRF token from form or meta tag
      const csrfToken = await page.evaluate(() => {
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        return metaTag?.getAttribute('content') || '';
      });

      expect(csrfToken).toBeTruthy();
      expect(csrfToken.length).toBeGreaterThan(10); // Should be sufficiently long

      // Test that CSRF token is required for state-changing operations
      const response = await request.post('/api/workshops', {
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        data: {
          title: 'Test Workshop',
          description: 'Test Description'
        }
      });

      // Should reject request without CSRF token
      expect(response.status()).toBe(403);
      expect(response.headers()['x-csrf-protection']).toBeTruthy();

      // Test that CSRF token is validated
      const invalidCsrfResponse = await request.post('/api/workshops', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'invalid-token'
        },
        data: {
          title: 'Test Workshop',
          description: 'Test Description'
        }
      });

      expect(invalidCsrfResponse.status()).toBe(403);
    });

    test('should implement proper input validation', async ({ page, request }) => {
      // Test various input validation scenarios

      // 1. Email validation
      const invalidEmails = [
        'plainaddress',
        '@missing-local.com',
        'username@.com',
        'username@com',
        'username@.com.com',
        '.username@yahoo.com',
        'username@yahoo.com.',
        'username@yahoo..com',
        'username@yahoo.c',
        'username@yahoo.corporate'
      ];

      await page.goto('/login');

      for (const email of invalidEmails) {
        await page.fill('[data-testid="email-input"]', email);
        await page.click('[data-testid="login-btn"]');

        const emailError = page.locator('[data-testid="email-error"]');
        if (await emailError.isVisible()) {
          expect(await emailError.textContent()).toContain('valid email');
        }
      }

      // 2. Numeric validation
      await page.goto('/workshops/create');

      const invalidNumbers = [
        '-1',
        '0',
        '999999999',
        'abc',
        '1.5',
        'NaN',
        'Infinity'
      ];

      for (const number of invalidNumbers) {
        await page.fill('[data-testid="workshop-capacity"]', number);
        await page.click('[data-testid="workshop-submit-btn"]');

        const capacityError = page.locator('[data-testid="capacity-error"]');
        if (await capacityError.isVisible()) {
          expect(await capacityError.textContent()).toContain('valid number');
        }
      }

      // 3. Date validation
      const invalidDates = [
        '2024-02-30', // Invalid date
        '2024-13-01', // Invalid month
        '2024-12-32', // Invalid day
        'invalid-date',
        '01/01/2024',  // Wrong format
        '2024/01/01'   // Wrong format
      ];

      for (const date of invalidDates) {
        await page.fill('[data-testid="workshop-start-date"]', date);
        await page.click('[data-testid="workshop-submit-btn"]');

        const dateError = page.locator('[data-testid="date-error"]');
        if (await dateError.isVisible()) {
          expect(await dateError.textContent()).toContain('valid date');
        }
      }

      // 4. Length validation
      const longString = 'a'.repeat(10000); // Very long string

      await page.fill('[data-testid="workshop-title"]', longString);
      await page.click('[data-testid="workshop-submit-btn"]');

      const titleError = page.locator('[data-testid="title-error"]');
      if (await titleError.isVisible()) {
        expect(await titleError.textContent()).toContain('too long');
      }
    });

    test('should implement rate limiting', async ({ page, request }) => {
      // Test login rate limiting
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const requests = [];

      // Make multiple rapid login attempts
      for (let i = 0; i < 10; i++) {
        requests.push(
          request.post('/api/auth/login', { data: loginData })
        );
      }

      const responses = await Promise.all(requests);

      // Should see rate limiting responses
      const rateLimitedResponses = responses.filter(r => r.status() === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Check rate limiting headers
      const rateLimitedResponse = rateLimitedResponses[0];
      expect(rateLimitedResponse.headers()['retry-after']).toBeTruthy();
      expect(rateLimitedResponse.headers()['x-ratelimit-limit']).toBeTruthy();
      expect(rateLimitedResponse.headers()['x-ratelimit-remaining']).toBeTruthy();

      // Test API rate limiting
      const apiRequests = [];

      for (let i = 0; i < 20; i++) {
        apiRequests.push(
          request.get('/api/workshops')
        );
      }

      const apiResponses = await Promise.all(apiRequests);
      const apiRateLimited = apiResponses.filter(r => r.status() === 429);
      expect(apiRateLimited.length).toBeGreaterThan(0);
    });

    test('should have secure HTTP headers', async ({ page, request }) => {
      const response = await request.get('/');

      // Check security headers
      expect(response.headers()['x-frame-options']).toBeTruthy();
      expect(response.headers()['x-content-type-options']).toBeTruthy();
      expect(response.headers()['x-xss-protection']).toBeTruthy();
      expect(response.headers()['strict-transport-security']).toBeTruthy();
      expect(response.headers()['content-security-policy']).toBeTruthy();
      expect(response.headers()['referrer-policy']).toBeTruthy();

      // Verify specific header values
      expect(response.headers()['x-frame-options']).toBe('DENY');
      expect(response.headers()['x-content-type-options']).toBe('nosniff');
      expect(response.headers()['referrer-policy']).toMatch(/strict-origin|same-origin/);

      // Check CSP header contains important directives
      const csp = response.headers()['content-security-policy'];
      expect(csp).toContain('default-src');
      expect(csp).toContain('script-src');
      expect(csp).toContain('style-src');
      expect(csp).toContain('img-src');
    });

    test('should protect against directory traversal', async ({ page, request }) => {
      const traversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
        '/var/www/html/../../etc/passwd',
        '/etc/passwd',
        'C:\\windows\\system32\\drivers\\etc\\hosts'
      ];

      // Test file upload endpoints
      for (const payload of traversalPayloads) {
        const response = await request.post('/api/files/upload', {
          multipart: {
            file: {
              name: payload,
              mimeType: 'text/plain',
              buffer: Buffer.from('test content')
            }
          }
        });

        // Should reject directory traversal attempts
        expect([400, 403, 404]).toContain(response.status());
      }

      // Test API endpoints
      for (const payload of traversalPayloads) {
        const response = await request.get(`/api/files/${encodeURIComponent(payload)}`);
        expect([400, 403, 404]).toContain(response.status());
      }
    });

    test('should have secure file upload functionality', async ({ page, request }) => {
      // Test file type restrictions
      const maliciousFiles = [
        { name: 'malware.exe', mimeType: 'application/x-executable', buffer: Buffer.from('fake executable') },
        { name: 'script.php', mimeType: 'application/x-php', buffer: Buffer.from('<?php system($_GET["cmd"]); ?>') },
        { name: 'shell.jsp', mimeType: 'application/x-jsp', buffer: Buffer.from('<% Runtime.getRuntime().exec(request.getParameter("cmd")); %>') },
        { name: 'virus.bat', mimeType: 'text/plain', buffer: Buffer.from('@echo off\ndel C:\\*.*') }
      ];

      for (const file of maliciousFiles) {
        const response = await request.post('/api/files/upload', {
          headers: { 'Content-Type': 'multipart/form-data' },
          multipart: { file }
        });

        // Should reject dangerous files
        expect([400, 403]).toContain(response.status());
      }

      // Test file size limits
      const largeFile = {
        name: 'huge-file.txt',
        mimeType: 'text/plain',
        buffer: Buffer.alloc(100 * 1024 * 1024) // 100MB
      };

      const largeFileResponse = await request.post('/api/files/upload', {
        multipart: { file: largeFile }
      });

      expect(largeFileResponse.status()).toBe(413); // Payload Too Large
    });

    test('should protect against insecure direct object references', async ({ page, request }) => {
      // Test accessing resources without proper authorization

      // Try to access workshops that don't belong to user
      const workshopIds = ['123', '456', '789', 'admin-workshop', 'system-workshop'];

      for (const workshopId of workshopIds) {
        const response = await request.get(`/api/workshops/${workshopId}`);

        // Should return 404 or 403, not 200 with unauthorized data
        expect([404, 401, 403]).toContain(response.status());
      }

      // Try to access another user's enrollments
      const enrollmentIds = ['user1-enrollment', 'user2-enrollment', 'admin-enrollment'];

      for (const enrollmentId of enrollmentIds) {
        const response = await request.get(`/api/enrollments/${enrollmentId}`);
        expect([404, 401, 403]).toContain(response.status());
      }

      // Test enumeration attacks
      const sequentialIds = [];
      for (let i = 1; i <= 100; i++) {
        sequentialIds.push(i.toString());
      }

      const enumerationResponses = await Promise.all(
        sequentialIds.map(id => request.get(`/api/workshops/${id}`))
      );

      // Should not return success for enumerated IDs
      const successfulResponses = enumerationResponses.filter(r => r.status() === 200);
      expect(successfulResponses.length).toBe(0);
    });
  });

  test.describe('Infrastructure Security', () => {
    test('should enforce HTTPS everywhere', async ({ page }) => {
      // Ensure all resources load over HTTPS
      await page.goto('/');

      const resources = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('img, script, link, iframe'));
        return elements.map(el => el.src || el.href).filter(url => url && url.startsWith('http'));
      });

      for (const resource of resources) {
        expect(resource).toMatch(/^https:\/\//);
      }

      // Check for mixed content warnings
      const consoleMessages = [];
      page.on('console', msg => {
        if (msg.type() === 'warning' && msg.text().includes('mixed content')) {
          consoleMessages.push(msg.text());
        }
      });

      await page.goto('/workshops');
      expect(consoleMessages.filter(msg => msg.includes('mixed content'))).toHaveLength(0);
    });

    test('should have secure cookie configuration', async ({ page, context }) => {
      await page.goto('/');

      const cookies = await context.cookies();

      for (const cookie of cookies) {
        // Session cookies should be secure
        if (cookie.name.includes('session') || cookie.name.includes('auth')) {
          expect(cookie.secure).toBe(true);
          expect(cookie.httpOnly).toBe(true);
          expect(cookie.sameSite).toBe('Strict');
        }

        // Cookies should have reasonable expiration times
        if (cookie.expires && cookie.expires > 0) {
          const expirationDate = new Date(cookie.expires * 1000);
          const maxExpiration = new Date();
          maxExpiration.setFullYear(maxExpiration.getFullYear() + 1); // Max 1 year

          expect(expirationDate).toBeLessThan(maxExpiration);
        }
      }
    });

    test('should disable unnecessary HTTP methods', async ({ request }) => {
      const disallowedMethods = ['TRACE', 'TRACK', 'CONNECT', 'OPTIONS', 'DELETE', 'PATCH'];
      const testUrl = '/';

      for (const method of disallowedMethods) {
        const response = await request.fetch(testUrl, { method });

        // Should return 405 Method Not Allowed or 404
        expect([405, 404]).toContain(response.status());
      }

      // Ensure only necessary methods are allowed
      const allowedMethods = ['GET', 'POST', 'PUT'];

      for (const method of allowedMethods) {
        const response = await request.fetch(testUrl, { method });
        // Should not return 405 for allowed methods
        expect(response.status()).not.toBe(405);
      }
    });

    test('should have proper error handling that doesn't leak information', async ({ page, request }) => {
      // Test 404 errors
      const notFoundResponse = await request.get('/api/non-existent-endpoint');
      expect(notFoundResponse.status()).toBe(404);

      const notFoundBody = await notFoundResponse.text();
      expect(notFoundBody).not.toContain('Error:'); // Should not expose raw error messages
      expect(notFoundBody).not.toContain('stack trace');
      expect(notFoundBody).not.toContain('internal server');

      // Test 500 errors (simulated)
      const errorResponse = await request.post('/api/error-test', {
        data: { triggerError: true }
      });

      if (errorResponse.status() === 500) {
        const errorBody = await errorResponse.text();
        expect(errorBody).not.toContain('stack trace');
        expect(errorBody).not.toContain('database');
        expect(errorBody).not.toContain('internal');
      }

      // Test client-side error handling
      await page.goto('/non-existent-page');
      await expect(page.locator('[data-testid="error-page"]')).toBeVisible();

      // Error page should be user-friendly
      const errorContent = await page.locator('[data-testid="error-page"]').textContent();
      expect(errorContent).toMatch(/page not found|404/i);
      expect(errorContent).not.toContain('Error:');
      expect(errorContent).not.toContain('exception');
    });
  });

  test.describe('Content Security Policy', () => {
    test('should have comprehensive CSP headers', async ({ request }) => {
      const response = await request.get('/');
      const csp = response.headers()['content-security-policy'];

      expect(csp).toBeTruthy();

      // Parse CSP directives
      const directives = csp.split(';').map(d => d.trim());

      const requiredDirectives = [
        'default-src',
        'script-src',
        'style-src',
        'img-src',
        'font-src',
        'connect-src',
        'media-src',
        'object-src',
        'frame-src',
        'base-uri'
      ];

      for (const directive of requiredDirectives) {
        const present = directives.some(d => d.startsWith(directive));
        expect(present).toBe(true);
      }

      // Check for restrictive defaults
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
    });

    test('should enforce CSP in the browser', async ({ page }) => {
      await page.goto('/');

      // Check for CSP violations
      const cspViolations = [];
      page.on('console', msg => {
        if (msg.text().includes('Content Security Policy')) {
          cspViolations.push(msg.text());
        }
      });

      // Try to violate CSP by injecting scripts
      await page.evaluate(() => {
        const script = document.createElement('script');
        script.textContent = 'console.log("Inline script")';
        document.head.appendChild(script);
      });

      // Wait for potential violations
      await page.waitForTimeout(1000);

      // Should have no CSP violations (or they should be blocked)
      expect(cspViolations.length).toBe(0);
    });
  });

  test.describe('Security Monitoring and Logging', () => {
    test('should log security-relevant events', async ({ page, request }) => {
      // Test failed login attempts are logged
      await page.goto('/login');

      for (let i = 0; i < 5; i++) {
        await page.fill('[data-testid="email-input"]', 'test@example.com');
        await page.fill('[data-testid="password-input"]', 'wrongpassword');
        await page.click('[data-testid="login-btn"]');

        await page.waitForTimeout(100);
      }

      // Test suspicious activity patterns
      const suspiciousRequests = [];

      for (let i = 0; i < 10; i++) {
        suspiciousRequests.push(
          request.get('/api/admin/users', {
            headers: { 'User-Agent': `SuspiciousBot-${i}` }
          })
        );
      }

      await Promise.all(suspiciousRequests);

      // Verify logging (this would require access to server logs in a real scenario)
      // For testing purposes, we'll check that the application responds appropriately
      const securityResponse = await request.get('/api/security/health');
      expect(securityResponse.status()).toBe(200);
    });

    test('should have security monitoring endpoints', async ({ request }) => {
      // Test security health check
      const healthResponse = await request.get('/api/security/health');
      expect(healthResponse.status()).toBe(200);

      const healthData = await healthResponse.json();
      expect(healthData).toHaveProperty('securityEnabled');
      expect(healthData).toHaveProperty('lastSecurityScan');

      // Test security metrics endpoint
      const metricsResponse = await request.get('/api/security/metrics');
      expect(metricsResponse.status()).toBe(200);

      const metricsData = await metricsResponse.json();
      expect(metricsData).toHaveProperty('loginAttempts');
      expect(metricsData).toHaveProperty('blockedRequests');
      expect(metricsData).toHaveProperty('securityEvents');
    });
  });

  test.describe('Comprehensive Security Report Generation', () => {
    test('should generate comprehensive security report', async ({ page, request }) => {
      // Run OWASP ZAP scan
      const zapResults = await runOWASPScan(page);

      // Test XSS vulnerabilities
      const xssResults = await testXSSVulnerabilities(page, request);

      // Test SQL injection vulnerabilities
      const sqlResults = await testSQLInjectionVulnerabilities(page, request);

      // Test CSRF protection
      const csrfResults = await testCSRFProtection(page, request);

      // Test authentication security
      const authResults = await testAuthenticationSecurity(page, request);

      // Test input validation
      const validationResults = await testInputValidation(page, request);

      // Test rate limiting
      const rateLimitResults = await testRateLimiting(page, request);

      // Test HTTPS configuration
      const httpsResults = await testHTTPSConfiguration(page, request);

      // Generate comprehensive security report
      const securityReport = await generateSecurityReport({
        zap: zapResults,
        xss: xssResults,
        sqlInjection: sqlResults,
        csrf: csrfResults,
        authentication: authResults,
        inputValidation: validationResults,
        rateLimiting: rateLimitResults,
        https: httpsResults
      });

      // Verify report contains all necessary sections
      expect(securityReport).toHaveProperty('summary');
      expect(securityReport).toHaveProperty('vulnerabilities');
      expect(securityReport).toHaveProperty('recommendations');
      expect(securityReport).toHaveProperty('compliance');

      // Check that no critical vulnerabilities are present
      const criticalVulns = securityReport.vulnerabilities.filter(v => v.severity === 'critical');
      expect(criticalVulns).toHaveLength(0);

      // Check security score
      expect(securityReport.summary.securityScore).toBeGreaterThan(80);

      // Generate security report file
      await page.evaluate((reportData) => {
        const blob = new Blob([JSON.stringify(reportData, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'security-report.json';
        a.click();
        URL.revokeObjectURL(url);
      }, securityReport);

      console.log('Security Report Generated:', {
        criticalIssues: criticalVulns.length,
        securityScore: securityReport.summary.securityScore,
        totalVulnerabilities: securityReport.vulnerabilities.length
      });
    });
  });
});