import { Page } from '@playwright/test';

/**
 * E2E Authentication Helpers
 *
 * Provides utilities for E2E authentication testing using Playwright
 */

export class E2EAuthHelper {
  /**
   * Authenticate a user via E2E UI flow
   */
  static async authenticateUser(
    page: Page,
    email: string = 'admin@test.com',
    password: string = 'password'
  ): Promise<void> {
    // Navigate to login page
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill in login form
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.click('[data-testid="login-button"]');

    // Wait for successful login - redirect to dashboard
    await page.waitForURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  }

  /**
   * Logout user
   */
  static async logoutUser(page: Page): Promise<void> {
    // Click user menu
    await page.click('[data-testid="user-menu"]');

    // Click logout button
    await page.click('[data-testid="logout-button"]');

    // Wait for redirect to login page
    await page.waitForURL('/login');
  }

  /**
   * Check if user is authenticated
   */
  static async isAuthenticated(page: Page): Promise<boolean> {
    try {
      const userMenu = page.locator('[data-testid="user-menu"]');
      await expect(userMenu).toBeVisible({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

// Export convenience function
export const authenticateUser = E2EAuthHelper.authenticateUser;