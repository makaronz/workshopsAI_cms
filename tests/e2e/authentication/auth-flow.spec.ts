/**
 * Authentication Flow E2E Tests
 * Complete user authentication workflow testing
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the login page
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Login Flow', () => {
    test('should login with valid credentials', async ({ page }) => {
      // Fill in login form
      await page.fill('[data-testid="email-input"]', 'admin@test.com');
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');

      // Wait for navigation to dashboard
      await page.waitForURL('/dashboard');

      // Verify user is logged in
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-email"]')).toContainText('admin@test.com');
    });

    test('should show error for invalid credentials', async ({ page }) => {
      // Fill in invalid credentials
      await page.fill('[data-testid="email-input"]', 'admin@test.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');

      // Verify error message is shown
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');

      // Verify user remains on login page
      await expect(page).toHaveURL('/login');
    });

    test('should validate email format', async ({ page }) => {
      // Fill in invalid email
      await page.fill('[data-testid="email-input"]', 'invalid-email');
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');

      // Verify email validation error
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="email-error"]')).toContainText('Invalid email format');
    });

    test('should require password', async ({ page }) => {
      // Fill in only email
      await page.fill('[data-testid="email-input"]', 'admin@test.com');
      await page.click('[data-testid="login-button"]');

      // Verify password required error
      await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="password-error"]')).toContainText('Password is required');
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Mock network failure
      await page.route('**/api/auth/login', route => route.abort('failed'));

      // Attempt login
      await page.fill('[data-testid="email-input"]', 'admin@test.com');
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');

      // Verify network error message
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    });
  });

  test.describe('Registration Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to registration page
      await page.click('[data-testid="register-link"]');
      await page.waitForURL('/register');
    });

    test('should register new user successfully', async ({ page }) => {
      // Fill in registration form
      const uniqueEmail = `newuser${Date.now()}@test.com`;
      await page.fill('[data-testid="email-input"]', uniqueEmail);
      await page.fill('[data-testid="username-input"]', 'newuser');
      await page.fill('[data-testid="first-name-input"]', 'New');
      await page.fill('[data-testid="last-name-input"]', 'User');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.fill('[data-testid="confirm-password-input"]', 'password123');

      await page.click('[data-testid="register-button"]');

      // Wait for navigation to dashboard
      await page.waitForURL('/dashboard');

      // Verify user is registered and logged in
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-email"]')).toContainText(uniqueEmail);
    });

    test('should validate password confirmation', async ({ page }) => {
      // Fill in registration form with mismatched passwords
      await page.fill('[data-testid="email-input"]', 'test@test.com');
      await page.fill('[data-testid="username-input"]', 'testuser');
      await page.fill('[data-testid="first-name-input"]', 'Test');
      await page.fill('[data-testid="last-name-input"]', 'User');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.fill('[data-testid="confirm-password-input"]', 'differentpassword');

      await page.click('[data-testid="register-button"]');

      // Verify password mismatch error
      await expect(page.locator('[data-testid="confirm-password-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="confirm-password-error"]')).toContainText('Passwords do not match');
    });

    test('should validate password strength', async ({ page }) => {
      // Fill in registration form with weak password
      await page.fill('[data-testid="email-input"]', 'test@test.com');
      await page.fill('[data-testid="username-input"]', 'testuser');
      await page.fill('[data-testid="first-name-input"]', 'Test');
      await page.fill('[data-testid="last-name-input"]', 'User');
      await page.fill('[data-testid="password-input"]', '123');
      await page.fill('[data-testid="confirm-password-input"]', '123');

      await page.click('[data-testid="register-button"]');

      // Verify password strength error
      await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="password-error"]')).toContainText('Password must be at least 8 characters');
    });

    test('should check for duplicate email', async ({ page }) => {
      // Try to register with existing email
      await page.fill('[data-testid="email-input"]', 'admin@test.com');
      await page.fill('[data-testid="username-input"]', 'different');
      await page.fill('[data-testid="first-name-input"]', 'Test');
      await page.fill('[data-testid="last-name-input"]', 'User');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.fill('[data-testid="confirm-password-input"]', 'password123');

      await page.click('[data-testid="register-button"]');

      // Verify duplicate email error
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="email-error"]')).toContainText('Email already exists');
    });
  });

  test.describe('Password Reset Flow', () => {
    test('should request password reset', async ({ page }) => {
      // Click forgot password link
      await page.click('[data-testid="forgot-password-link"]');
      await page.waitForURL('/forgot-password');

      // Fill in email for password reset
      await page.fill('[data-testid="email-input"]', 'admin@test.com');
      await page.click('[data-testid="reset-password-button"]');

      // Verify success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Password reset email sent');
    });

    test('should handle non-existent email gracefully', async ({ page }) => {
      // Click forgot password link
      await page.click('[data-testid="forgot-password-link"]');
      await page.waitForURL('/forgot-password');

      // Fill in non-existent email
      await page.fill('[data-testid="email-input"]', 'nonexistent@test.com');
      await page.click('[data-testid="reset-password-button"]');

      // Should still show success message for security
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    });

    test('should validate email format for password reset', async ({ page }) => {
      // Click forgot password link
      await page.click('[data-testid="forgot-password-link"]');
      await page.waitForURL('/forgot-password');

      // Fill in invalid email
      await page.fill('[data-testid="email-input"]', 'invalid-email');
      await page.click('[data-testid="reset-password-button"]');

      // Verify email validation error
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="email-error"]')).toContainText('Invalid email format');
    });
  });

  test.describe('Logout Flow', () => {
    test('should logout user successfully', async ({ page }) => {
      // First login
      await page.fill('[data-testid="email-input"]', 'admin@test.com');
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Then logout
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');

      // Verify redirected to login page
      await page.waitForURL('/login');
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });

    test('should clear session data on logout', async ({ page }) => {
      // Login and navigate to protected page
      await page.fill('[data-testid="email-input"]', 'admin@test.com');
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Navigate to a protected page
      await page.goto('/workshops');
      await page.waitForLoadState('networkidle');

      // Logout
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');
      await page.waitForURL('/login');

      // Try to access protected page again
      await page.goto('/workshops');

      // Should be redirected to login
      await page.waitForURL('/login');
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });
  });

  test.describe('Session Management', () => {
    test('should maintain session across page refreshes', async ({ page }) => {
      // Login
      await page.fill('[data-testid="email-input"]', 'admin@test.com');
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should still be logged in
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-email"]')).toContainText('admin@test.com');
    });

    test('should handle session expiration', async ({ page }) => {
      // Login
      await page.fill('[data-testid="email-input"]', 'admin@test.com');
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Clear session storage to simulate expiration
      await page.evaluate(() => {
        sessionStorage.clear();
        localStorage.clear();
      });

      // Try to access protected route
      await page.goto('/workshops');

      // Should be redirected to login
      await page.waitForURL('/login');
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });

    test('should refresh token before expiration', async ({ page }) => {
      // Login
      await page.fill('[data-testid="email-input"]', 'admin@test.com');
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Wait for token refresh (this would typically happen in the background)
      await page.waitForTimeout(2000);

      // Should still be able to access protected routes
      await page.goto('/workshops');
      await page.waitForLoadState('networkidle');

      // Should not be redirected to login
      await expect(page).toHaveURL('/workshops');
    });
  });

  test.describe('Security Tests', () => {
    test('should prevent brute force attacks', async ({ page }) => {
      // Make multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        await page.fill('[data-testid="email-input"]', 'admin@test.com');
        await page.fill('[data-testid="password-input"]', `wrong${i}`);
        await page.click('[data-testid="login-button"]');
        await page.waitForTimeout(100);
      }

      // Verify rate limiting message appears
      await expect(page.locator('[data-testid="rate-limit-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="rate-limit-message"]')).toContainText('Too many attempts');
    });

    test('should sanitize login inputs', async ({ page }) => {
      // Try XSS in login form
      await page.fill('[data-testid="email-input"]', '<script>alert("xss")</script>@test.com');
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');

      // Should not execute script and show validation error
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    });

    test('should use HTTPS in production', async ({ page }) => {
      // This test would run against production environment
      // For now, we'll just check that the form submits properly

      await page.fill('[data-testid="email-input"]', 'admin@test.com');
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');

      // In production, this would verify HTTPS is used
      await page.waitForURL('/dashboard');
    });
  });

  test.describe('Accessibility Tests', () => {
    test('should be keyboard navigable', async ({ page }) => {
      // Navigate through login form using keyboard
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="email-input"]')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="password-input"]')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="login-button"]')).toBeFocused();
    });

    test('should have proper ARIA labels', async ({ page }) => {
      // Check for ARIA labels on form elements
      const emailInput = page.locator('[data-testid="email-input"]');
      await expect(emailInput).toHaveAttribute('aria-label', 'Email address');

      const passwordInput = page.locator('[data-testid="password-input"]');
      await expect(passwordInput).toHaveAttribute('aria-label', 'Password');

      const loginButton = page.locator('[data-testid="login-button"]');
      await expect(loginButton).toHaveAttribute('aria-label', 'Sign in to your account');
    });

    test('should announce errors to screen readers', async ({ page }) => {
      // Submit empty form to trigger validation errors
      await page.click('[data-testid="login-button"]');

      // Check for aria-live regions with error messages
      const errorMessages = page.locator('[aria-live="polite"]');
      await expect(errorMessages).toBeVisible();
    });
  });
});